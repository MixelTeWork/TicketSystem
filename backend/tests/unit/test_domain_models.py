from datetime import datetime

import pytest


NOW = datetime(2026, 9, 26, 12, 30)


def test_new_event_grants_creator_access(db_session, admin):
    from data.event import Event

    event = Event.new(admin, "Model event", NOW)

    assert event.id is not None
    assert admin.has_access(event.id)
    assert Event.all_for_user(admin) == [event]
    assert event.get_dict() == {
        "id": event.id,
        "name": "Model event",
        "date": "2026-09-26 12:30:00",
    }


def test_ticket_types_get_stable_per_event_numbers(db_session, admin):
    from data.event import Event
    from data.ticket_type import TicketType

    event = Event.new(admin, "Numbered types", NOW)
    first, _ = TicketType.add(admin, event, "First", None, NOW)
    second, _ = TicketType.add(admin, event, "Second", 500, NOW)
    db_session.commit()

    assert (first.number, second.number) == (0, 1)
    assert event.lastTypeNumber == 2
    assert second.get_dict() == {
        "id": second.id,
        "name": "Second",
        "imageId": None,
        "pattern": None,
        "price": 500,
    }


def test_generated_ticket_code_and_counter(db_session, admin, monkeypatch):
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    event = Event.new(admin, "Codes", datetime(2026, 3, 7, 10, 0))
    ticket_type, _ = TicketType.add(admin, event, "Main", None, NOW)
    db_session.commit()
    monkeypatch.setattr("data.ticket.randint", lambda _start, _end: 42)

    ticket, error = Ticket.new(admin, ticket_type, event, "", "", "", "")
    db_session.commit()

    assert error is None
    assert ticket.code == "001-60307-42-00-0001"
    assert event.lastTicketNumber == 1


def test_manual_ticket_code_cannot_reuse_soft_deleted_ticket(db_session, admin):
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    event = Event.new(admin, "Unique", NOW)
    ticket_type, _ = TicketType.add(admin, event, "Main", None, NOW)
    db_session.commit()
    ticket, error = Ticket.new(admin, ticket_type, event, "", "", "", "SAME")
    assert error is None
    ticket.delete(admin)

    duplicate, error = Ticket.new(admin, ticket_type, event, "", "", "", "SAME")

    assert duplicate is None
    assert error == "Ticket with 'code=SAME' already exist"


def test_deleted_ticket_type_is_marked_in_ticket_contract(db_session, admin):
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    event = Event.new(admin, "History", NOW)
    ticket_type, _ = TicketType.add(admin, event, "Historic", None, NOW)
    db_session.commit()
    ticket, _ = Ticket.new(admin, ticket_type, event, "", "", "", "HISTORY")
    ticket_type.delete(admin)

    assert ticket.get_dict()["type"] == "<Удалён>Historic"


def test_manager_staff_and_event_access_queries(
    db_session, admin, user_factory
):
    from data._roles import Roles
    from data.event import Event
    from data.user import User

    manager = user_factory("manager", "Manager", Roles.manager)
    clerk = user_factory("clerk", "Clerk", Roles.clerk, boss_id=manager.id)
    outsider = user_factory("outsider", "Outsider", Roles.clerk, boss_id=admin.id)
    event = Event.new(manager, "Staff event", NOW)
    clerk.add_access(event.id, manager)

    assert User.all_user_staff(manager) == [clerk]
    assert User.all_event_staff(manager, event.id) == [clerk]
    assert clerk.has_access(event.id)
    assert not outsider.has_access(event.id)


def test_ticket_update_records_all_observable_fields(db_session, admin):
    from bafser import Log
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    event = Event.new(admin, "Update", NOW)
    first, _ = TicketType.add(admin, event, "First", None, NOW)
    second, _ = TicketType.add(admin, event, "Second", 100, NOW)
    db_session.commit()
    ticket, _ = Ticket.new(admin, first, event, "Old", "old", "OLD", "UPDATE", 50)

    ticket.update(admin, second.id, "New", "new", "NEW", 75)

    assert ticket.typeId == second.id
    assert ticket.personName == "New"
    assert ticket.personLink == "new"
    assert ticket.promocode == "NEW"
    assert ticket.price == 75
    latest = db_session.query(Log).order_by(Log.id.desc()).first()
    changed_fields = {change[0] for change in latest.changes}
    assert {"typeId", "personName", "personLink", "promocode", "price"} <= changed_fields
