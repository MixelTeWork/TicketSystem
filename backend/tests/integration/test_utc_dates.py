from __future__ import annotations

from typing import TYPE_CHECKING

from datetime import date, datetime, timedelta, timezone

import pytest
from factories import single_day_variant

if TYPE_CHECKING:
    from data.user import User
    from flask.testing import FlaskClient
    from sqlalchemy.orm import Session


@pytest.mark.parametrize(
    "value",
    [
        "0999-12-31",
        "10000-01-01",
        "2026-02-29",
        "2026-10-12junk",
        "0999-12-31T23:59:59Z",
        "2026-10-12T25:00:00Z",
        "0001-01-01T00:00:00+03:00",
    ],
)
def test_event_api_rejects_dates_outside_storage_and_moscow_range(logged_in_admin: FlaskClient, db_session: Session, value: str):
    from data.event import Event

    event = logged_in_admin.post("/api/events", json={"name": "Original", "date": "2026-10-12"}).get_json()
    for url in ["/api/events", f"/api/events/{event['id']}"]:
        response = logged_in_admin.post(url, json={"name": "Invalid date", "date": value})
        assert response.status_code == 400
    db_session.expire_all()
    assert db_session.query(Event).count() == 1
    stored = db_session.get(Event, event["id"])
    assert stored.name == "Original"
    assert stored.date == date(2026, 10, 12)


@pytest.mark.parametrize(
    "value,expected",
    [
        ("1000-01-01", date(1000, 1, 1)),
        ("9999-12-31", date(9999, 12, 31)),
        ("9999-12-31T23:00:00Z", date(9999, 12, 31)),
        ("1000-01-01T02:59:59+03:00", date(1000, 1, 1)),
        ("9999-12-31T20:59:59.999999Z", date(9999, 12, 31)),
        ("9999-12-31T23:59:59+03:00", date(9999, 12, 31)),
    ],
)
def test_event_range_boundaries_allow_ticket_creation(logged_in_admin: FlaskClient, db_session: Session, admin: User, value: str, expected: date):
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    response = logged_in_admin.post("/api/events", json={"name": "Boundary", "date": value})
    assert response.status_code == 200
    event_id = response.get_json()["id"]
    response = logged_in_admin.post(f"/api/events/{event_id}", json={"name": "Updated boundary", "date": value})
    assert response.status_code == 200
    assert response.get_json()["date"] == expected.isoformat()
    db_session.rollback()
    event = db_session.get(Event, event_id)
    assert type(event.date) is date and event.date == expected
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket_type = single_day_variant(admin, event, "Type", None, datetime(2026, 10, 12))
    db_session.commit()
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket = Ticket.new(admin, ticket_type, event, "Person", "", "", "")
    admin.db_sess.commit()
    assert ticket.code


@pytest.mark.parametrize(
    "value",
    [
        "2026-10-12",
        "2026-10-12T18:00:00+03:00",
        "2026-10-12T15:00:00Z",
        "2026-10-12T15:00:00",
        "2026-10-12T00:30:00+14:00",
        "2026-10-12T23:30:00-04:00",
    ],
)
def test_event_api_stores_calendar_part_without_timezone_conversion(logged_in_admin: FlaskClient, db_session: Session, value: str):
    from bafser import Log
    from sqlalchemy import Date, DateTime, inspect

    from data._tables import Tables
    from data.event import Event

    response = logged_in_admin.post("/api/events", json={"name": "Calendar event", "date": value})
    assert response.status_code == 200
    data = response.get_json()
    assert data["date"] == "2026-10-12" and data["endDate"] == "2026-10-12"
    db_session.rollback()
    assert db_session.get(Event, data["id"]).date == date(2026, 10, 12)
    added = db_session.query(Log).filter_by(tableName=Tables.Event, recordId=data["id"], actionCode="added").one()
    assert ["date", None, "2026-10-12"] in added.changes
    assert ["endDate", None, "2026-10-12"] in added.changes
    column_type = next(column["type"] for column in inspect(db_session.get_bind()).get_columns(Tables.Event) if column["name"] == "date")
    assert isinstance(column_type, Date) and not isinstance(column_type, DateTime)
    response = logged_in_admin.post(f"/api/events/{data['id']}", json={"name": "Updated", "date": "2026-10-13T00:30:00+14:00"})
    assert response.get_json()["date"] == "2026-10-13"
    db_session.rollback()
    log = db_session.query(Log).filter_by(tableName=Tables.Event, recordId=data["id"], actionCode="updated").one()
    assert ["date", "2026-10-12", "2026-10-13"] in log.changes


def test_shared_and_ticket_timestamps_are_actual_utc(db_session: Session, admin: User):
    from bafser import Log, get_datetime_utc

    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType
    from data.user import User

    before = get_datetime_utc().replace(tzinfo=None)
    event = Event.new(admin, "UTC", date(2026, 10, 13))
    User.new(admin, "utc_staff", "test-password", "UTC staff", [], admin.id)
    # User creation, audit logs and ticket dates all use the same clock.
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket_type = single_day_variant(admin, event, "Type", None, get_datetime_utc())
    db_session.commit()
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket = Ticket.new(admin, ticket_type, event, "Person", "", "", "")
    admin.db_sess.commit()
    Ticket.get(ticket.id, for_update=True, db_sess=ticket.db_sess)
    ticket.record_checkin(admin, event.days[0], now=get_datetime_utc(), commit=True)
    after = get_datetime_utc().replace(tzinfo=None)
    if db_session.get_bind().dialect.name == "mysql":
        # Existing DATETIME rounds to whole seconds, possibly above `after`.
        before = before.replace(microsecond=0)
        after = after.replace(microsecond=0) + timedelta(seconds=1)
    db_session.expire_all()
    assert before <= ticket.createdDate <= after
    assert before <= ticket.checkins[0].checkedAt <= after
    assert "61013" in ticket.code  # Event calendar date is Moscow's October 13.
    assert ticket.get_dict()["createdDate"].endswith("Z")
    assert all(before <= log.date <= after for log in db_session.query(Log).all())


def test_ticket_date_filter_uses_a_complete_moscow_day(logged_in_admin: FlaskClient, db_session: Session, admin: User):
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    event = Event.new(admin, "Day boundaries", date(2026, 10, 12))
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket_type = single_day_variant(admin, event, "Type", None, datetime(2026, 10, 1))
    start = datetime(2026, 10, 11, 21)
    # Production DATETIME has second precision; MySQL rounds fractional inserts.
    dates = [start - timedelta(seconds=1), start, start + timedelta(days=1) - timedelta(seconds=1), start + timedelta(days=1)]
    for index, created_date in enumerate(dates):
        db_session.add(Ticket(createdDate=created_date, createdById=admin.id, eventId=event.id, typeId=ticket_type.id, code=f"BOUNDARY-{index}"))
    db_session.commit()
    response = logged_in_admin.post(f"/api/events/{event.id}/tickets/page", json={"dateFrom": "2026-10-12", "dateTo": "2026-10-12"})
    assert response.status_code == 200
    assert [item["code"] for item in response.get_json()["items"]] == ["BOUNDARY-2", "BOUNDARY-1"]
