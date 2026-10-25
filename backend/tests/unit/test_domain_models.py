from datetime import datetime, timedelta, timezone

import pytest


NOW = datetime(2026, 9, 26, 12, 30)


@pytest.mark.parametrize("invalid", [
    datetime(999, 12, 31), datetime(9999, 12, 31, 21),
    datetime(1, 1, 1, tzinfo=timezone(timedelta(hours=3))),
])
def test_event_models_reject_invalid_dates_without_changes(db_session, admin, invalid):
    from bafser import Log
    from data.event import Event

    event = Event.new(admin, "Original", NOW)
    log_count = db_session.query(Log).count()
    with pytest.raises(ValueError, match="Дата должна быть"):
        Event.new(admin, "Invalid", invalid)
    with pytest.raises(ValueError, match="Дата должна быть"):
        event.update(admin, "Invalid update", invalid)
    assert event.name == "Original" and event.date == NOW
    assert db_session.query(Event).count() == 1
    assert db_session.query(Log).count() == log_count


def test_event_models_normalize_offsets_before_validation(db_session, admin):
    from data.event import Event

    event = Event.new(admin, "Offset", datetime(1000, 1, 1, 3, tzinfo=timezone(timedelta(hours=3))))
    assert event.date == Event.DATE_MIN
    event.update(admin, "Updated", datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone(timedelta(hours=3))))
    assert event.date == Event.DATE_MAX


def test_new_event_grants_creator_access(db_session, admin):
    from data.event import Event

    event = Event.new(admin, "Model event", NOW)

    assert event.id is not None
    assert admin.has_access(event.id)
    assert Event.all_for_user(admin) == [event]
    assert event.get_dict() == {
        "id": event.id,
        "name": "Model event",
        "date": "2026-09-26T12:30:00.000000Z",
        "active": True,
    }
    event.active = False
    assert event.get_dict()["active"] is False


def test_new_event_rolls_back_if_creator_access_fails(db_session, admin, monkeypatch):
    from bafser import Log
    from data.event import Event
    from data.permission_access import PermissionAccess

    def fail_access(*_args, **_kwargs):
        raise RuntimeError("access failed")

    monkeypatch.setattr(PermissionAccess, "new", fail_access)

    with pytest.raises(RuntimeError, match="access failed"):
        Event.new(admin, "Unreachable", NOW)

    db_session.rollback()
    assert db_session.query(Event).count() == 0
    assert db_session.query(Log).count() == 0


def test_deleting_event_also_deletes_its_image(db_session, admin):
    from bafser import Log
    from data.event import Event
    from data.img import Image
    from data.ticket_type import TicketType

    event = Event.new(admin, "With design", NOW)
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    ticket_type, _ = TicketType.add(admin, event, "Main", None, NOW)
    image = Image(
        name="background", type="png", creationDate=NOW,
        createdById=admin.id, accessEventId=event.id,
    )
    db_session.add(image)
    ticket_type.image = image
    db_session.commit()

    assert event.delete(admin)
    assert event.deleted
    assert image.deleted
    assert db_session.query(Log).filter_by(
        tableName="Image", recordId=image.id, actionCode="deleted"
    ).count() == 1


def test_ticket_types_get_stable_per_event_numbers(db_session, admin):
    from data.event import Event
    from data.ticket_type import TicketType

    event = Event.new(admin, "Numbered types", NOW)
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    first, first_log = TicketType.add(admin, event, "First", None, NOW)
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    second, second_log = TicketType.add(admin, event, "Second", 500, NOW)
    db_session.commit()

    assert (first.number, second.number) == (0, 1)
    assert event.lastTypeNumber == 2
    assert (first_log.recordId, second_log.recordId) == (first.id, second.id)
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
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    ticket_type, _ = TicketType.add(admin, event, "Main", None, NOW)
    db_session.commit()
    monkeypatch.setattr("data.ticket.randint", lambda _start, _end: 42)

    Event.get(event.id, for_update=True, db_sess=event.get_session())
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
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    ticket_type, _ = TicketType.add(admin, event, "Main", None, NOW)
    db_session.commit()
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    ticket, error = Ticket.new(admin, ticket_type, event, "", "", "", "SAME")
    assert error is None
    ticket.delete(admin)

    Event.get(event.id, for_update=True, db_sess=event.get_session())
    duplicate, error = Ticket.new(admin, ticket_type, event, "", "", "", "SAME")

    assert duplicate is None
    assert error == "Ticket with 'code=SAME' already exist"


def test_deleted_ticket_type_is_marked_in_ticket_contract(db_session, admin):
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    event = Event.new(admin, "History", NOW)
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    ticket_type, _ = TicketType.add(admin, event, "Historic", None, NOW)
    db_session.commit()
    Event.get(event.id, for_update=True, db_sess=event.get_session())
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

    assert User.all_staff_for_manager(manager) == [clerk]
    assert User.all_staff_for_event(manager, event.id) == [clerk]
    assert clerk.has_access(event.id)
    assert not outsider.has_access(event.id)


def test_ticket_update_records_all_observable_fields(db_session, admin):
    from bafser import Log
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    event = Event.new(admin, "Update", NOW)
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    first, _ = TicketType.add(admin, event, "First", None, NOW)
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    second, _ = TicketType.add(admin, event, "Second", 100, NOW)
    db_session.commit()
    Event.get(event.id, for_update=True, db_sess=event.get_session())
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


def test_ticket_stats_keep_deleted_types_but_exclude_deleted_tickets(db_session, admin):
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    event = Event.new(admin, "Stats", NOW)
    other_event = Event.new(admin, "Other", NOW)
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    historic, _ = TicketType.add(admin, event, "Historic", None, NOW)
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    current, _ = TicketType.add(admin, event, "Current", None, NOW)
    Event.get(other_event.id, for_update=True, db_sess=other_event.get_session())
    other_type, _ = TicketType.add(admin, other_event, "Other", None, NOW)
    db_session.commit()
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    scanned, _ = Ticket.new(admin, historic, event, "", "", "", "SCANNED")
    scanned.authOnPltf = True
    Ticket.get(scanned.id, for_update=True, db_sess=scanned.get_session())
    scanned.mark_scanned()
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    Ticket.new(admin, historic, event, "", "", "", "UNSCANNED")
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    deleted, _ = Ticket.new(admin, historic, event, "", "", "", "DELETED")
    Ticket.get(deleted.id, for_update=True, db_sess=deleted.get_session())
    deleted.mark_scanned()
    deleted.delete(admin)
    historic.delete(admin)
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    Ticket.new(admin, current, event, "", "", "", "CURRENT")
    Event.get(other_event.id, for_update=True, db_sess=other_event.get_session())
    Ticket.new(admin, other_type, other_event, "", "", "", "OTHER")

    stats = Ticket.stats_for_event(event.id, db_sess=db_session)

    assert sorted(stats, key=lambda row: row["typeId"]) == [
        {"typeId": historic.id, "count": 2, "scanned": 1, "authOnPltf": 1},
        {"typeId": current.id, "count": 1, "scanned": 0, "authOnPltf": 0},
    ]


def test_staff_access_replacement_preserves_other_managers_staff(
    db_session, admin, user_factory
):
    from bafser import Log
    from data._roles import Roles
    from data.event import Event
    from data.user import User

    manager = user_factory("manager", "Manager", Roles.manager)
    removed = user_factory("removed", "Removed", Roles.clerk, boss_id=manager.id)
    added = user_factory("added", "Added", Roles.clerk, boss_id=manager.id)
    outsider = user_factory("outsider", "Outsider", Roles.clerk, boss_id=admin.id)
    unselected = user_factory("unselected", "Unselected", Roles.clerk, boss_id=admin.id)
    event = Event.new(manager, "Access", NOW)
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
