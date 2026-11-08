from typing import Literal

from bafser import (
    Constants,
    JsonObj,
    JsonOpt,
    PublicError,
    TJson,
    Undefined,
    doc_api,
    get_datetime_utc,
    get_json_values_from_req,
    jsonify_list,
    protected_route,
    response_not_found,
)
from flask import Blueprint, abort, jsonify

from data._operations import Operations
from data.event import Event
from data.img import Image
from data.ticket_category import TicketCatalogData, TicketCategory
from data.ticket_type import TicketType, TicketTypeData
from data.user import User
from utils import access_required_by_eventId

blueprint = Blueprint("ticket_types", __name__)


class CategoryIdRefJson(JsonObj):
    id: int = JsonObj.field(min_value=1, max_value=Constants.INT32_MAX)


class CategoryClientRefJson(JsonObj):
    clientId: str = JsonObj.field(min_length=1)


class CategoryAddJson(JsonObj):
    action: Literal["add"]
    clientId: str = JsonObj.field(min_length=1)
    name: str = JsonObj.field(min_length=1, max_length=64)


class CategoryUpdateJson(JsonObj):
    action: Literal["update"]
    id: int = JsonObj.field(min_value=1, max_value=Constants.INT32_MAX)
    name: str = JsonObj.field(min_length=1, max_length=64)


class CategoryDeleteJson(JsonObj):
    action: Literal["delete"]
    id: int = JsonObj.field(min_value=1, max_value=Constants.INT32_MAX)


class VariantAddJson(JsonObj):
    action: Literal["add"]
    categoryRef: CategoryIdRefJson | CategoryClientRefJson
    dayOffsets: list[int]
    name: str = JsonObj.field(min_length=1, max_length=64)
    price: int | None = JsonObj.field(default=None, min_value=0, max_value=Constants.INT32_MAX)
    quantity: int | None = JsonObj.field(default=None, min_value=0, max_value=Constants.INT32_MAX)


class VariantUpdateJson(JsonObj):
    action: Literal["update"]
    id: int = JsonObj.field(min_value=1, max_value=Constants.INT32_MAX)
    name: JsonOpt[str] = JsonObj.field(min_length=1, max_length=64)
    price: JsonOpt[int | None] = JsonObj.field(min_value=0, max_value=Constants.INT32_MAX)
    quantity: JsonOpt[int | None] = JsonObj.field(min_value=0, max_value=Constants.INT32_MAX)


class VariantDeleteJson(JsonObj):
    action: Literal["delete"]
    id: int = JsonObj.field(min_value=1, max_value=Constants.INT32_MAX)


class CatalogChangesJson(JsonObj):
    categoryChanges: list[CategoryAddJson | CategoryUpdateJson | CategoryDeleteJson]
    typeChanges: list[VariantAddJson | VariantUpdateJson | VariantDeleteJson]


@blueprint.route("/api/events/<int:eventId>/ticket_types")
@doc_api(res=list[TicketTypeData], desc="Типы билетов события")
@protected_route(perms=Operations.page_events)
@access_required_by_eventId
def ticket_types(eventId: int):
    ttypes = TicketType.all_for_event(eventId)
    return jsonify_list(ttypes)


@blueprint.get("/api/events/<int:eventId>/ticket_categories")
@doc_api(res=TicketCatalogData, desc="Каталог категорий и состояний разновидностей")
@protected_route(perms=Operations.change_ticket_types)
@access_required_by_eventId
def ticket_categories(eventId: int):
    if Event.get(eventId) is None:
        return response_not_found("event", eventId)
    return jsonify(TicketCategory.catalog_for_event(eventId))


@blueprint.post("/api/events/<int:eventId>/ticket_types")
@doc_api(req=CatalogChangesJson, res=TicketCatalogData, desc="Изменить каталог билетов")
@protected_route(perms=Operations.change_ticket_types)
@access_required_by_eventId
def change_ticket_types(eventId: int):
    user = User.current
    data = CatalogChangesJson.get_from_req()

    event = Event.get(eventId, for_update=True)
    if event is None or event.deleted:
        return response_not_found("event", eventId)

    now = get_datetime_utc()
    clients: dict[str, TicketCategory] = {}

    def category_by_id(category_id: int) -> TicketCategory:
        category = TicketCategory.get(category_id, for_update=True)
        if category is None or category.eventId != event.id:
            raise PublicError("Category not found for this event")
        return category

    for change in data.categoryChanges:
        if isinstance(change, CategoryAddJson):
            if change.clientId in clients:
                raise PublicError("New category requires a unique clientId")
            clients[change.clientId] = TicketCategory.add(user, event, change.name, now)
        else:
            category = category_by_id(change.id)
            if isinstance(change, CategoryUpdateJson):
                category.update(user, change.name, commit=False, now=now)
            else:
                category.delete(user, commit=False, now=now)

    for change in data.typeChanges:
        if isinstance(change, VariantAddJson):
            ref = change.categoryRef
            if isinstance(ref, CategoryClientRefJson):
                category = clients.get(ref.clientId)
                if category is None or category.deleted:
                    raise PublicError("Unknown category clientId")
            else:
                category = category_by_id(ref.id)
            TicketType.add(user, event, change.name, change.price, now, category, change.dayOffsets, change.quantity)
        else:
            variant = TicketType.get(change.id, for_update=True)
            if variant is None:
                raise PublicError("TicketType not found for this event")
            if variant.eventId != event.id:
                raise PublicError("TicketType is for another event")
            variant.refresh_current_relations(event)
            if variant.category.deleted:
                raise PublicError("TicketType not found for this event")
            if isinstance(change, VariantUpdateJson):
                variant.update(
                    user,
                    variant.name if change.name is Undefined else change.name,
                    variant.price if change.price is Undefined else change.price,
                    quantity=change.quantity,
                    commit=False,
                    now=now,
                )
            else:
                variant.delete(user, commit=False, now=now)
    user.db_sess.commit()
    return jsonify(TicketCategory.catalog_for_event(eventId))


@blueprint.route("/api/ticket_types/<int:typeId>")
@doc_api(res=TicketTypeData, desc="Получить тип билета")
@protected_route(perms=Operations.page_events)
def ticket_type(typeId: int):
    user = User.current
    ttype = TicketType.get(typeId)
    if ttype is None:
        return response_not_found("ticketType", typeId)

    if not user.has_access(ttype.eventId):
        abort(403)

    return ttype.get_dict()


@blueprint.post("/api/ticket_types/<int:typeId>")
@doc_api(req=TJson["img", dict | None, "pattern", dict], res=TicketTypeData, desc="Изменить оформление типа билета")
@protected_route(perms=Operations.change_ticket_types)
def change_ticket_type(typeId: int):
    user = User.current
    img_json, pattern = get_json_values_from_req(("img", dict | None, None), ("pattern", dict))

    ttype = TicketType.get(typeId)
    if ttype is None:
        return response_not_found("ticketType", typeId)
    if not user.has_access(ttype.eventId):
        abort(403)

    event = Event.get(ttype.eventId, for_update=True)
    ttype = TicketType.get(typeId, for_update=True)
    if event is None or ttype is None:
        return response_not_found("ticketType", typeId)
    ttype.refresh_current_relations(event)
    if ttype.category.deleted:
        return response_not_found("ticketType", typeId)

    img = None
    if img_json is not None:
        img = Image.new(user, img_json, commit=False)
    ttype.update_design(user, pattern, img)
    user.db_sess.commit()

    return ttype.get_dict()
