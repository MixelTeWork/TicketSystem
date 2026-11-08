import hashlib
import json
from uuid import UUID

from bafser import (
    Constants,
    JsonObj,
    PublicError,
    TJson,
    doc_api,
    get_datetime_utc,
    get_json_values_from_req,
    jsonify_list,
    protected_route,
    response_msg,
    response_not_found,
)
from flask import Blueprint, abort, jsonify
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from data._operations import Operations
from data.event import Event
from data.request_operation import RequestOperation
from data.ticket import Ticket, TicketData, TicketPageData, TicketPageJson, TicketStatsData
from data.ticket_checkin import TicketCheckin
from data.ticket_type import TicketType
from data.user import User
from utils import access_required_by_eventId
from utils.dates import as_moscow

blueprint = Blueprint("tickets", __name__)


class TicketDetailsJson(JsonObj):
    typeId: int = JsonObj.field(min_value=1)
    personName: str = JsonObj.field(max_length=256)
    personLink: str = JsonObj.field(max_length=256)
    promocode: str = JsonObj.field(max_length=64)
    price: int | None = JsonObj.field(default=None, min_value=0, max_value=Constants.INT32_MAX)


class NewTicketJson(TicketDetailsJson):
    eventId: int = JsonObj.field(min_value=1)
    code: str = JsonObj.field(default="", max_length=32)
    requestId: str = JsonObj.field(min_length=1, max_length=64)
    allowOverLimit: bool = JsonObj.field(default=False)


class UpdateTicketJson(TicketDetailsJson):
    allowOverLimit: bool = JsonObj.field(default=False)


def request_identity(data: NewTicketJson):
    try:
        request_id = str(UUID(data.requestId))
    except (ValueError, AttributeError) as error:
        raise PublicError("requestId must be a UUID") from error
    payload = {name: getattr(data, name) for name in ("eventId", "typeId", "personName", "personLink", "promocode", "price", "code")}
    fingerprint = hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return request_id, fingerprint


def check_quota(event: Event, ticket_type: TicketType, allow_over_limit: bool):
    if ticket_type.quantity is None:
        return
    issued = Ticket.count_for_type_locked(event, ticket_type)
    if issued >= ticket_type.quantity and not allow_over_limit:
        raise PublicError(
            "Количество билетов превышает лимит. Подтвердите добавление сверх лимита.",
            code="ticket_limit_confirmation_required",
            status=409,
            details={
                "typeId": ticket_type.id,
                "quantity": ticket_type.quantity,
                "issuedCount": issued,
                "remaining": max(0, ticket_type.quantity - issued),
            },
        )


@blueprint.route("/api/events/<int:eventId>/tickets")
@doc_api(res=list[TicketData], desc="Билеты события")
@protected_route(perms=Operations.page_events)
@access_required_by_eventId
def tickets(eventId: int):
    tickets = Ticket.all_for_event(eventId)
    return jsonify_list(tickets)


@blueprint.post("/api/events/<int:eventId>/tickets/page")
@doc_api(req=TicketPageJson, res=TicketPageData, desc="Поиск, фильтры и пагинация билетов события")
@protected_route(perms=Operations.page_events)
@access_required_by_eventId
def tickets_page(eventId: int):
    params = TicketPageJson.get_from_req()
    return jsonify(Ticket.page_for_event(eventId, params))


@blueprint.post("/api/tickets")
@doc_api(req=NewTicketJson, res=TicketData, desc="Создать билет")
@protected_route(perms=Operations.add_ticket)
def add_ticket():
    user = User.current
    data = NewTicketJson.get_from_req()

    if not user.has_access(data.eventId):
        abort(403)

    session = user.db_sess
    for attempt in range(3):
        try:
            return _create_ticket(user, data)
        except OperationalError as error:
            session.rollback()
            if not error.orig.args or error.orig.args[0] != 1213 or attempt == 2:
                raise
            # InnoDB may choose this transaction as the victim of a gap-lock
            # conflict between independent events. Retry the same intention.
            if not user.has_access(data.eventId):
                abort(403)


def _create_ticket(user: User, data: NewTicketJson):
    session = user.db_sess
    actor_id = user.id
    try:
        request_id, fingerprint = request_identity(data)
        event = Event.get(data.eventId, for_update=True)
        if event is None:
            return response_not_found("event", data.eventId)
        previous = _request_operation(session, user.id, request_id)
        if previous is not None:
            return _replay(previous, fingerprint, session, event)
        ttype = TicketType.get(data.typeId, includeDeleted=True, for_update=True)
        if ttype is None:
            return response_not_found("ticketType", data.typeId)
        if ttype.eventId != data.eventId:
            raise PublicError(f"TicketType with 'typeId={data.typeId}' is for another event")
        ttype.refresh_current_relations(event)
        if not ttype.available:
            raise PublicError("Разновидность недоступна для выдачи", code="variant_unavailable", status=409)
        check_quota(event, ttype, data.allowOverLimit)
        ticket = Ticket.new(user, ttype, event, data.personName, data.personLink, data.promocode, data.code, data.price)
        session.flush()
        session.add(
            RequestOperation(
                actorId=user.id,
                action="create_ticket",
                requestId=request_id,
                requestHash=fingerprint,
                ticketId=ticket.id,
                createdAt=get_datetime_utc(),
            )
        )
        session.commit()
        return ticket.get_dict()
    except IntegrityError:
        # The winning request may belong to another event. Only an actual
        # operation record permits replay; unrelated constraints stay errors.
        session.rollback()
        if not user.has_access(data.eventId):
            abort(403)
        event = Event.get(data.eventId, for_update=True)
        if event is None:
            return response_not_found("event", data.eventId)
        previous = _request_operation(session, actor_id, request_id)
        if previous is None:
            raise
        return _replay(previous, fingerprint, session, event)


def _request_operation(session: Session, actor_id: int, request_id: str):
    return (
        session.query(RequestOperation)
        .filter_by(actorId=actor_id, action="create_ticket", requestId=request_id)
        .populate_existing()
        .with_for_update()
        .first()
    )


def _replay(operation: RequestOperation, fingerprint: str, session: Session, event: Event):
    if operation.requestHash != fingerprint:
        raise PublicError("requestId уже использован с другими данными", code="request_id_conflict", status=409)
    ticket = Ticket.get(operation.ticketId, includeDeleted=True, for_update=True, db_sess=session)
    if ticket is None or ticket.deleted:
        raise PublicError("Созданный билет удалён", code="request_result_deleted", status=409)
    ticket.refresh_current_details(event)
    result = ticket.get_dict()
    session.commit()
    return result


@blueprint.post("/api/tickets/<int:ticketId>")
@doc_api(req=UpdateTicketJson, res=TicketData, desc="Изменить билет")
@protected_route(perms=Operations.change_ticket)
def update_ticket(ticketId: int):
    user = User.current
    data = UpdateTicketJson.get_from_req()

    ticket = Ticket.get(ticketId)
    if ticket is None:
        return response_not_found("ticket", ticketId)
    if not user.has_access(ticket.eventId):
        abort(403)

    session = user.db_sess
    event = Event.get(ticket.eventId, for_update=True)
    ticket = Ticket.get(ticketId, for_update=True)
    if event is None or ticket is None:
        return response_not_found("ticket", ticketId)
    ttype = TicketType.get(data.typeId, includeDeleted=True, for_update=True)
    if ttype is None:
        return response_not_found("ticketType", data.typeId)
    if ttype.eventId != ticket.eventId:
        raise PublicError(f"TicketType with 'typeId={data.typeId}' is for another event")
    ttype.refresh_current_relations(event)
    if data.typeId != ticket.typeId:
        if not ttype.available:
            raise PublicError("Разновидность недоступна для выдачи", code="variant_unavailable", status=409)
        check_quota(event, ttype, data.allowOverLimit)
    ticket.update(user, data.typeId, data.personName, data.personLink, data.promocode, data.price)
    session.commit()
    return ticket.get_dict()


@blueprint.delete("/api/tickets/<int:ticketId>")
@doc_api(res=TJson["msg", str], desc="Удалить билет")
@protected_route(perms=Operations.delete_ticket)
def delete_ticket(ticketId: int):
    user = User.current
    ticket = Ticket.get(ticketId)
    if ticket is None:
        return response_not_found("ticket", ticketId)
    if not user.has_access(ticket.eventId):
        abort(403)

    Event.get(ticket.eventId, for_update=True)
    ticket = Ticket.get(ticketId, for_update=True)
    if ticket is None:
        return response_not_found("ticket", ticketId)
    ticket.delete(user)

    return response_msg("ok")


@blueprint.post("/api/check_ticket")
@doc_api(req=TJson["code", str, "eventId", int], res=dict, desc="Проверить билет")
@protected_route(perms=Operations.scan_tickets)
def check_ticket():
    return _scan_ticket("entry")


@blueprint.post("/api/issue_merch")
@doc_api(req=TJson["code", str, "eventId", int], res=dict, desc="Выдать мерч по билету")
@protected_route(perms=Operations.scan_tickets)
def issue_merch():
    return _scan_ticket("merch")


def _scan_ticket(operation: str):
    code, eventId = get_json_values_from_req(("code", str), ("eventId", int))
    user = User.current

    if not user.has_access(eventId):
        return response_msg("No permission", 403)

    event = Event.get(eventId, includeDeleted=True)
    if event is None:
        return response_not_found("event", eventId)
    if event.deleted or not event.active:
        return response_msg("Event is not active", 403, code="event_inactive")

    def result(
        success: bool, error: str | None = None, ticket: Ticket | None = None, other_event: Event | None = None, checkin: TicketCheckin | None = None
    ):
        return {
            "operation": operation,
            "success": success,
            "errorCode": error,
            "ticket": ticket.get_dict() if ticket is not None else None,
            "event": other_event.get_dict() if other_event is not None else None,
            "checkin": checkin.get_dict() if checkin is not None else None,
        }

    # Authorization only read data. End that snapshot before waiting for Ticket:
    # a concurrent transfer may reference a type created after the old snapshot.
    # The first SQL of the new transaction must be the Ticket locking read.
    session = user.db_sess
    if session.new or session.dirty or session.deleted:
        raise RuntimeError("Scanner authorization must not change database objects")
    session.rollback()
    ticket = Ticket.get_by_code(code, for_update=True)
    if ticket is None or not user.has_access(ticket.eventId):
        return result(False, "notExist")

    if ticket.eventId != eventId:
        return result(False, "event", ticket, ticket.event)

    checkins = ticket.load_checkins(current_read=False)
    now = get_datetime_utc()
    if operation == "merch":
        if ticket.merchIssuedAt is not None:
            return result(False, "merchIssued", ticket)
        ticket.record_merch_issue(user, now=now, commit=False)
        session.commit()
        return result(True, ticket=ticket)

    # The read-only authorization snapshot was ended before Ticket was locked.
    # Its fresh snapshot sees all prior checkins; Ticket serializes new writes.
    if event.day_count == 1:
        if checkins:
            prior = max(checkins, key=lambda entry: (entry.checkedAt is not None, entry.checkedAt or now, entry.id))
            return result(False, "scanned", ticket, checkin=prior)
        day = next(day for day in event.days if day.dayOffset == 0)
    else:
        today = as_moscow(now).date()
        day = next((day for day in event.days if day.date == today), None)
        if day is None or day.dayOffset not in ticket.type.day_offsets:
            return result(False, "date", ticket)
        prior = next((entry for entry in checkins if entry.eventDayId == day.id), None)
        if prior is not None:
            return result(False, "scanned", ticket, checkin=prior)
    checkin = ticket.record_checkin(user, day, now=now, commit=False)
    session.commit()
    return result(True, ticket=ticket, checkin=checkin)


@blueprint.route("/api/events/<int:eventId>/tickets_stats")
@doc_api(res=list[TicketStatsData], desc="Статистика билетов")
@protected_route(perms=Operations.page_events)
@access_required_by_eventId
def tickets_stats(eventId: int):
    return jsonify(Ticket.stats_for_event(eventId))
