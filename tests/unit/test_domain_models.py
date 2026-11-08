from __future__ import annotations

from typing import TYPE_CHECKING

from datetime import date, datetime, timedelta, timezone

import pytest
from bafser import Log, PublicError
from factories import single_day_variant

if TYPE_CHECKING:
    from data.user import User
    from fixture_types import UserFactory
    from sqlalchemy.orm import Session
    from typing import Any

NOW = datetime(2026, 9, 26, 12, 30)
EVENT_DATE = date(2026, 9, 26)


@pytest.mark.parametrize(
    "invalid",
    [
        date(999, 12, 31),
        datetime(2026, 9, 26, 12, 30),
        datetime(999, 12, 31),
        datetime(9999, 12, 31, 21),
        datetime(1, 1, 1, tzinfo=timezone(timedelta(hours=3))),
    ],
)
def test_event_models_reject_invalid_dates_without_changes(db_session: Session, admin: User, invalid: date):
    from bafser import Log

    from data.event import Event

    event = Event.new(admin, "Original", EVENT_DATE)
    log_count = db_session.query(Log).count()
    with pytest.raises(PublicError, match="Дата должна быть"):
        Event(name="Invalid constructor", date=invalid, endDate=EVENT_DATE)
    with pytest.raises(PublicError, match="Дата должна быть"):
        Event.new(admin, "Invalid", invalid)
    with pytest.raises(PublicError, match="Дата должна быть"):
        event.update(admin, "Invalid update", invalid)
    assert event.name == "Original" and event.date == NOW.date()
    assert db_session.query(Event).count() == 1
    assert db_session.query(Log).count() == log_count


def test_event_models_validate_calendar_boundaries_without_conversion(db_session: Session, admin: User):
    from data.event import Event

    event = Event.new(admin, "Offset", date(1000, 1, 1))
    assert event.date == date(1000, 1, 1)
    event.update(admin, "Updated", date(9999, 12, 31))
    assert event.date == date(9999, 12, 31)
    assert Event.validate_date(EVENT_DATE) is None


def test_new_event_grants_creator_access(db_session: Session, admin: User):
    from data.event import Event

    event = Event.new(admin, "Model event", EVENT_DATE)

    assert event.id is not None
    assert admin.has_access(event.id)
    assert Event.all_for_user(admin) == [event]
    assert event.get_dict() == {
        "id": event.id,
        "name": "Model event",
        "date": "2026-09-26",
        "active": True,
        "endDate": "2026-09-26",
        "dayCount": 1,
        "days": [{"id": event.days[0].id, "dayOffset": 0, "date": "2026-09-26"}],
    }
    event.active = False
    assert event.get_dict()["active"] is False


def test_new_event_rolls_back_if_creator_access_fails(db_session: Session, admin: User, monkeypatch: pytest.MonkeyPatch):
    from bafser import Log

    from data.event import Event
    from data.permission_access import PermissionAccess

    def fail_access(*_args: Any, **_kwargs: Any):
        raise RuntimeError("access failed")

    monkeypatch.setattr(PermissionAccess, "new", fail_access)

    with pytest.raises(RuntimeError, match="access failed"):
        Event.new(admin, "Unreachable", EVENT_DATE)

    db_session.rollback()
    assert db_session.query(Event).count() == 0
    assert db_session.query(Log).count() == 0


def test_deleting_event_also_deletes_its_image(db_session: Session, admin: User):
    from bafser import Log

    from data.event import Event
    from data.img import Image

    event = Event.new(admin, "With design", EVENT_DATE)
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket_type = single_day_variant(admin, event, "Main", None, NOW)
    image = Image(
        name="background",
        type="png",
        creationDate=NOW,
        createdById=admin.id,
        accessEventId=event.id,
    )
    db_session.add(image)
    ticket_type.image = image
    db_session.commit()

    assert event.delete(admin)
    assert event.deleted
    assert image.deleted
    assert db_session.query(Log).filter_by(tableName="Image", recordId=image.id, actionCode="deleted").count() == 1


def test_ticket_types_get_stable_per_event_numbers(db_session: Session, admin: User):
    from data.event import Event

    event = Event.new(admin, "Numbered types", EVENT_DATE)
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    first = single_day_variant(admin, event, "First", None, NOW)
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    second = single_day_variant(admin, event, "Second", 500, NOW)
    db_session.commit()

    assert (first.number, second.number) == (0, 1)
    assert event.lastTypeNumber == 2
    assert second.get_dict() == {
        "id": second.id,
        "name": "Second",
        "imageId": None,
        "pattern": None,
        "price": 500,
        "quantity": None,
        "categoryId": second.categoryId,
        "dayOffsets": [0],
        "validDates": ["2026-09-26"],
    }


def test_generated_ticket_code_and_counter(db_session: Session, admin: User, monkeypatch: pytest.MonkeyPatch):
    from data.event import Event
    from data.ticket import Ticket

    event = Event.new(admin, "Codes", date(2026, 3, 7))
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket_type = single_day_variant(admin, event, "Main", None, NOW)
    db_session.commit()
    monkeypatch.setattr("data.ticket.randint", lambda _start, _end: 42)

    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket = Ticket.new(admin, ticket_type, event, "", "", "", "")
    db_session.commit()

    assert ticket.code == "001-60307-42-00-0001"
    assert event.lastTicketNumber == 1


def test_manual_ticket_code_cannot_reuse_soft_deleted_ticket(db_session: Session, admin: User):
    from data.event import Event
    from data.ticket import Ticket

    event = Event.new(admin, "Unique", EVENT_DATE)
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket_type = single_day_variant(admin, event, "Main", None, NOW)
    db_session.commit()
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket = Ticket.new(admin, ticket_type, event, "", "", "", "SAME")
    ticket.delete(admin)

    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    before_logs = db_session.query(Log).count()
    before_number = event.lastTicketNumber
    with pytest.raises(PublicError) as error:
        Ticket.new(admin, ticket_type, event, "", "", "", "SAME")

    assert str(error.value) == "Ticket with 'code=SAME' already exist"
    assert error.value.status == 400
    assert db_session.query(Ticket).count() == 1
    assert db_session.query(Log).count() == before_logs
    assert event.lastTicketNumber == before_number
    assert not db_session.new


def test_deleted_ticket_type_is_marked_in_ticket_contract(db_session: Session, admin: User):
    from data.event import Event
    from data.ticket import Ticket

    event = Event.new(admin, "History", EVENT_DATE)
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket_type = single_day_variant(admin, event, "Historic", None, NOW)
    db_session.commit()
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket = Ticket.new(admin, ticket_type, event, "", "", "", "HISTORY")
    ticket_type.delete(admin)

    assert ticket.get_dict()["type"] == "Historic"
    assert ticket.get_dict()["typeDeleted"] is True


def test_manager_staff_and_event_access_queries(db_session: Session, admin: User, user_factory: UserFactory):
    from data._roles import Roles
    from data.event import Event
    from data.user import User

    manager = user_factory("manager", "Manager", Roles.manager)
    clerk = user_factory("clerk", "Clerk", Roles.clerk, boss_id=manager.id)
    outsider = user_factory("outsider", "Outsider", Roles.clerk, boss_id=admin.id)
    event = Event.new(manager, "Staff event", EVENT_DATE)
    clerk.add_access(event.id, manager)

    assert User.all_staff_for_manager(manager) == [clerk]
    assert User.all_staff_for_event(manager, event.id) == [clerk]
    assert clerk.has_access(event.id)
    assert not outsider.has_access(event.id)


def test_ticket_update_records_all_observable_fields(db_session: Session, admin: User):
    from bafser import Log

    from data.event import Event
    from data.ticket import Ticket

    event = Event.new(admin, "Update", EVENT_DATE)
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    first = single_day_variant(admin, event, "First", None, NOW)
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    second = single_day_variant(admin, event, "Second", 100, NOW)
    db_session.commit()
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket = Ticket.new(admin, first, event, "Old", "old", "OLD", "UPDATE", 50)

    ticket.update(admin, second.id, "New", "new", "NEW", 75)
    db_session.commit()

    assert ticket.typeId == second.id
    assert ticket.personName == "New"
    assert ticket.personLink == "new"
    assert ticket.promocode == "NEW"
    assert ticket.price == 75
    latest = db_session.query(Log).order_by(Log.id.desc()).first()
    changed_fields = {change[0] for change in latest.changes}
    assert {"typeId", "personName", "personLink", "promocode", "price"} <= changed_fields


def test_ticket_stats_keep_deleted_types_but_exclude_deleted_tickets(db_session: Session, admin: User):
    from data.event import Event
    from data.ticket import Ticket

    event = Event.new(admin, "Stats", EVENT_DATE)
    other_event = Event.new(admin, "Other", EVENT_DATE)
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    historic = single_day_variant(admin, event, "Historic", None, NOW)
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    current = single_day_variant(admin, event, "Current", None, NOW)
    Event.get(other_event.id, for_update=True, db_sess=other_event.db_sess)
    other_type = single_day_variant(admin, other_event, "Other", None, NOW)
    db_session.commit()
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    scanned = Ticket.new(admin, historic, event, "", "", "", "SCANNED")
    scanned.authOnPltf = True
    Ticket.get(scanned.id, for_update=True, db_sess=scanned.db_sess)
    scanned.record_checkin(admin, event.days[0], now=NOW, commit=True)
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    Ticket.new(admin, historic, event, "", "", "", "UNSCANNED")
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    deleted = Ticket.new(admin, historic, event, "", "", "", "DELETED")
    Ticket.get(deleted.id, for_update=True, db_sess=deleted.db_sess)
    deleted.record_checkin(admin, event.days[0], now=NOW, commit=True)
    deleted.delete(admin)
    historic.delete(admin)
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    Ticket.new(admin, current, event, "", "", "", "CURRENT")
    Event.get(other_event.id, for_update=True, db_sess=other_event.db_sess)
    Ticket.new(admin, other_type, other_event, "", "", "", "OTHER")

    stats = Ticket.stats_for_event(event.id, db_sess=db_session)

    assert [{key: row[key] for key in ("typeId", "count", "scanned", "authOnPltf")} for row in sorted(stats, key=lambda row: row["typeId"])] == [
        {"typeId": historic.id, "count": 2, "scanned": 1, "authOnPltf": 1},
        {"typeId": current.id, "count": 1, "scanned": 0, "authOnPltf": 0},
    ]


def test_staff_access_replacement_preserves_other_managers_staff(db_session: Session, admin: User, user_factory: UserFactory):
    from bafser import Log

    from data._roles import Roles
    from data.event import Event
    from data.user import User

    manager = user_factory("manager", "Manager", Roles.manager)
    removed = user_factory("removed", "Removed", Roles.clerk, boss_id=manager.id)
    added = user_factory("added", "Added", Roles.clerk, boss_id=manager.id)
    outsider = user_factory("outsider", "Outsider", Roles.clerk, boss_id=admin.id)
    unselected = user_factory("unselected", "Unselected", Roles.clerk, boss_id=admin.id)
    event = Event.new(manager, "Access", EVENT_DATE)
    removed.add_access(event.id, manager)
    outsider.add_access(event.id, admin)

    manager.set_staff_event_access(event.id, [added.id, added.id, unselected.id])
    db_session.expire_all()

    assert not removed.has_access(event.id)
    assert added.has_access(event.id)
    assert outsider.has_access(event.id)
    assert not unselected.has_access(event.id)
    assert User.all_staff_for_event(manager, event.id) == [added]
    log_count = db_session.query(Log).count()
    manager.set_staff_event_access(event.id, [added.id])
    assert db_session.query(Log).count() == log_count
