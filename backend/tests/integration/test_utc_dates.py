from datetime import datetime, timedelta, timezone

import pytest


@pytest.mark.parametrize("value", [
    "0999-12-31T23:59:59Z",
    "1000-01-01T02:59:59+03:00",
    "9999-12-31T23:00:00Z",
    "9999-12-31T21:00:00Z",
    "9999-12-31T20:59:59.999999Z",
    "0001-01-01T00:00:00+03:00",
])
def test_event_api_rejects_dates_outside_storage_and_moscow_range(logged_in_admin, db_session, value):
    from data.event import Event

    event = logged_in_admin.post("/api/events", json={"name": "Original", "date": "2026-10-12T15:00:00Z"}).get_json()
    for url in ["/api/events", f"/api/events/{event['id']}"]:
        response = logged_in_admin.post(url, json={"name": "Invalid date", "date": value})
        assert response.status_code == 400
    db_session.expire_all()
    assert db_session.query(Event).count() == 1
    stored = db_session.get(Event, event["id"])
    assert stored.name == "Original"
    assert stored.date == datetime(2026, 10, 12, 15)


@pytest.mark.parametrize("value,expected", [
    ("1000-01-01T00:00:00Z", datetime(1000, 1, 1)),
    ("1000-01-01T03:00:00+03:00", datetime(1000, 1, 1)),
    ("9999-12-31T20:59:59Z", datetime(9999, 12, 31, 20, 59, 59)),
    ("9999-12-31T23:59:59+03:00", datetime(9999, 12, 31, 20, 59, 59)),
])
def test_event_range_boundaries_allow_ticket_creation(logged_in_admin, db_session, admin, value, expected):
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    response = logged_in_admin.post("/api/events", json={"name": "Boundary", "date": value})
    assert response.status_code == 200
    event_id = response.get_json()["id"]
    response = logged_in_admin.post(f"/api/events/{event_id}", json={"name": "Updated boundary", "date": value})
    assert response.status_code == 200
    # The admin fixture opened MySQL's repeatable-read snapshot before the API insert.
    db_session.rollback()
    event = db_session.get(Event, event_id)
    assert event.date == expected
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    ticket_type, _ = TicketType.add(admin, event, "Type", None, datetime(2026, 10, 12))
    db_session.commit()
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    ticket, error = Ticket.new(admin, ticket_type, event, "Person", "", "", "")
    assert error is None
    assert ticket.code


@pytest.mark.parametrize("value", ["2026-10-12T18:00:00+03:00", "2026-10-12T15:00:00Z", "2026-10-12T15:00:00"])
def test_event_api_stores_utc_and_returns_an_explicit_offset(logged_in_admin, db_session, value):
    from data.event import Event

    response = logged_in_admin.post("/api/events", json={"name": "UTC event", "date": value})
    assert response.status_code == 200
    data = response.get_json()
    assert data["date"] == "2026-10-12T15:00:00.000000Z"
    db_session.expire_all()
    assert db_session.get(Event, data["id"]).date == datetime(2026, 10, 12, 15, 0)
    response = logged_in_admin.post(f"/api/events/{data['id']}", json={"name": "Updated", "date": "2026-10-13T00:30:00+03:00"})
    assert response.get_json()["date"] == "2026-10-12T21:30:00.000000Z"


def test_shared_and_ticket_timestamps_are_actual_utc(db_session, admin):
    from bafser import Log, get_datetime_utc
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType
    from data.user import User

    before = get_datetime_utc().replace(tzinfo=None)
    event = Event.new(admin, "UTC", datetime(2026, 10, 12, 22, tzinfo=timezone.utc))
    User.new(admin, "utc_staff", "test-password", "UTC staff", [], admin.id)
    # User creation, audit logs and ticket dates all use the same clock.
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    ticket_type, _ = TicketType.add(admin, event, "Type", None, get_datetime_utc())
    db_session.commit()
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    ticket, error = Ticket.new(admin, ticket_type, event, "Person", "", "", "")
    assert error is None
    Ticket.get(ticket.id, for_update=True, db_sess=ticket.get_session())
    ticket.mark_scanned(admin)
    after = get_datetime_utc().replace(tzinfo=None)
    if db_session.get_bind().dialect.name == "mysql":
        # Existing DATETIME rounds to whole seconds, possibly above `after`.
        before = before.replace(microsecond=0)
        after = after.replace(microsecond=0) + timedelta(seconds=1)
    db_session.expire_all()
    assert before <= ticket.createdDate <= after
    assert before <= ticket.scannedDate <= after
    assert "61013" in ticket.code  # Event calendar date is Moscow's October 13.
    assert ticket.get_dict()["createdDate"].endswith("Z")
    assert all(before <= log.date <= after for log in db_session.query(Log).all())


def test_ticket_date_filter_uses_a_complete_moscow_day(logged_in_admin, db_session, admin):
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    event = Event.new(admin, "Day boundaries", datetime(2026, 10, 12))
    Event.get(event.id, for_update=True, db_sess=event.get_session())
    ticket_type, _ = TicketType.add(admin, event, "Type", None, datetime(2026, 10, 1))
    start = datetime(2026, 10, 11, 21)
    # Production DATETIME has second precision; MySQL rounds fractional inserts.
    dates = [start - timedelta(seconds=1), start, start + timedelta(days=1) - timedelta(seconds=1), start + timedelta(days=1)]
    for index, date in enumerate(dates):
        db_session.add(Ticket(createdDate=date, createdById=admin.id, eventId=event.id, typeId=ticket_type.id, code=f"BOUNDARY-{index}"))
    db_session.commit()
    response = logged_in_admin.post(f"/api/events/{event.id}/tickets/page", json={"dateFrom": "2026-10-12", "dateTo": "2026-10-12"})
    assert response.status_code == 200
    assert [item["code"] for item in response.get_json()["items"]] == ["BOUNDARY-2", "BOUNDARY-1"]
