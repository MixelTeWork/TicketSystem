from __future__ import annotations

from typing import TYPE_CHECKING

from data.ticket_category import TicketCategory
from factories import single_day_variant
from contextlib import contextmanager
from datetime import date, datetime

import pytest
from sqlalchemy import event as sa_event, inspect
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from data.user import User
    from fixture_types import IssuedData, UserFactory
    from flask import Flask
    from sqlalchemy.engine import Connection, ExecutionContext
    from sqlalchemy.engine.interfaces import DBAPICursor


@contextmanager
def statements(session: Session):
    queries = []

    def record(connection: Connection, cursor: DBAPICursor, statement: str, parameters: object, context: ExecutionContext, executemany: bool):
        queries.append(statement)

    engine = session.get_bind()
    sa_event.listen(engine, "before_cursor_execute", record)
    try:
        yield queries
    finally:
        sa_event.remove(engine, "before_cursor_execute", record)


@pytest.fixture
def issued(db_session: Session, admin: User):
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_checkin import TicketCheckin
    from data.ticket_type import TicketType
    from data.ticket_type_day import TicketTypeDay

    now = datetime(2026, 10, 31, 10)
    event = Event.new(admin, "Loading", date(2026, 10, 31), twoDays=True)
    Event.get(event.id, for_update=True, db_sess=db_session)
    variants = {
        name: TicketType.add(admin, event, name, 100, now, dayOffsets=offsets, category=TicketCategory.add(admin, event, name, now))
        for name, offsets in (("Both", [0, 1]), ("First", [0]), ("Empty", [1]),
                              ("Removed", [1]), ("Archived", [0]), ("Unused", [0]))
    }
    variants["Removed"].deleted = True
    variants["Archived"].category.deleted = True
    variants["Unused"].deleted = True
    for variant in variants.values():
        variant.pattern = {"unused": "ticket design"}
    db_session.commit()
    days = {day.dayOffset: day.id for day in event.days}
    type_ids = {name: variant.id for name, variant in variants.items()}
    rows = [
        {"createdDate": now, "createdById": admin.id, "eventId": event.id,
         "typeId": type_ids[("Both", "First", "Removed", "Archived")[index % 4]],
         "code": f"LOADING-{index}", "authOnPltf": index % 5 == 0, "deleted": index % 11 == 0,
         "merchIssuedAt": now if index % 3 == 0 else None,
         "merchIssuedById": admin.id if index % 3 == 0 else None}
        for index in range(72)
    ]
    db_session.execute(Ticket.__table__.insert(), rows)
    ticket_ids = dict(db_session.query(Ticket.code, Ticket.id).filter_by(eventId=event.id).all())
    checkins = []
    for index, row in enumerate(rows):
        row["id"] = ticket_ids[row["code"]]
        row["offsets"] = ([0] if index % 4 else []) + ([1] if index % 3 == 0 else [])
        for offset in row["offsets"]:
            checkins.append({"ticketId": row["id"], "eventDayId": days[offset],
                             "checkedAt": now if index % 2 else None,
                             "checkedById": admin.id if index % 2 else None})
    db_session.execute(TicketCheckin.__table__.insert(), checkins)
    # An unrelated event must not contribute tickets or checkins to this event's stats.
    other = Event.new(admin, "Other", date(2026, 11, 1))
    Event.get(other.id, for_update=True, db_sess=db_session)
    other_type = single_day_variant(admin, other, "Other", 0, now)
    db_session.flush()
    Ticket.new(admin, other_type, other, "", "", "", "OTHER-LOADING")
    admin.db_sess.commit()
    checkin_id = db_session.query(TicketCheckin.id).first()[0]
    link_id = db_session.query(TicketTypeDay.id).filter_by(typeId=type_ids["Both"]).first()[0]
    return {"event": event.id, "types": type_ids, "tickets": rows, "days": days,
            "checkin": checkin_id, "link": link_id}


@pytest.mark.parametrize("model_name, key, relationships", [
    ("Ticket", "ticket", {"checkins", "event", "type", "createdBy", "merchIssuedBy"}),
    ("Event", "event", {"all_days", "tickets", "ticket_types", "categories"}),
    ("TicketType", "type", {"days", "category", "image", "event"}),
    ("TicketCheckin", "checkin", {"day", "checkedBy", "ticket"}),
    ("TicketTypeDay", "link", {"day", "type"}),
])
def test_plain_queries_do_not_load_relationships(db_session: Session, issued: IssuedData, model_name: str, key: str, relationships: set[str]):
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_checkin import TicketCheckin
    from data.ticket_type import TicketType
    from data.ticket_type_day import TicketTypeDay

    models = {model.__name__: model for model in (Ticket, Event, TicketType, TicketCheckin, TicketTypeDay)}
    ids = {**issued, "ticket": issued["tickets"][0]["id"], "type": issued["types"]["Both"]}
    with Session(db_session.get_bind()) as session, statements(session) as queries:
        item = session.query(models[model_name]).filter_by(id=ids[key]).one()
        assert relationships <= inspect(item).unloaded
        assert len(queries) == 1
        assert "JOIN" not in queries[0].upper()


def test_ticket_display_is_batched_and_does_not_load_user_permissions(db_session: Session, issued: IssuedData):
    from data.ticket import Ticket
    from data.user import User

    with Session(db_session.get_bind()) as session:
        with statements(session) as queries:
            tickets = Ticket.all_for_event(issued["event"], db_sess=session)
        assert len(queries) <= 5
        assert all("UserRole" not in query and "Permission" not in query for query in queries)
        actors = [item for item in session.identity_map.values() if isinstance(item, User)]
        assert actors
        assert all({"roles", "password"} <= inspect(actor).unloaded for actor in actors)
        assert all("pattern" in inspect(ticket.type).unloaded for ticket in tickets)
        with statements(session) as serialization_queries:
            data = [ticket.get_dict() for ticket in tickets]
        assert not serialization_queries
        live = [row for row in issued["tickets"] if not row["deleted"]]
        assert len(data) == len(live)
        assert sum(len(row["checkins"]) for row in data) == sum(len(row["offsets"]) for row in live)
        assert any(checkin["checkedBy"] is not None for row in data for checkin in row["checkins"])
        assert any(row["merchIssuedBy"] is not None for row in data)


def test_stats_aggregate_without_loading_tickets_or_checkins(db_session: Session, issued: IssuedData):
    from data.ticket import Ticket
    from data.ticket_checkin import TicketCheckin

    with Session(db_session.get_bind()) as session:
        loaded = []
        sa_event.listen(session, "loaded_as_persistent", lambda session, item: loaded.append(type(item)))
        with statements(session) as queries:
            stats = Ticket.stats_for_event(issued["event"], db_sess=session)
        assert Ticket not in loaded and TicketCheckin not in loaded
        assert len(queries) <= 7
        by_type = {row["typeId"]: row for row in stats}
        assert issued["types"]["Unused"] not in by_type
        assert by_type[issued["types"]["Empty"]]["count"] == 0
        assert by_type[issued["types"]["Removed"]]["deleted"] is True
        assert by_type[issued["types"]["Archived"]]["categoryDeleted"] is True
        for name in ("Both", "First", "Removed", "Archived", "Empty"):
            type_id = issued["types"][name]
            tickets = [row for row in issued["tickets"] if row["typeId"] == type_id and not row["deleted"]]
            result = by_type[type_id]
            assert {key: result[key] for key in ("count", "scanned", "authOnPltf", "merchIssued", "checkinCount")} == {
                "count": len(tickets), "scanned": sum(bool(row["offsets"]) for row in tickets),
                "authOnPltf": sum(row["authOnPltf"] for row in tickets),
                "merchIssued": sum(row["merchIssuedAt"] is not None for row in tickets),
                "checkinCount": sum(len(row["offsets"]) for row in tickets),
            }
            for day in result["byDay"]:
                offset = day["dayOffset"]
                assert day["checkedIn"] == sum(offset in row["offsets"] for row in tickets)
                assert day["eligible"] == (len(tickets) if offset in result["dayOffsets"] else 0)
                assert day["date"] == ("2026-10-31" if offset == 0 else "2026-11-01")


def test_stats_keep_historical_checkins_after_transfer_and_period_shortening(db_session: Session, admin: User):
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    now = datetime(2026, 11, 1, 10)
    event = Event.new(admin, "History", date(2026, 10, 31), twoDays=True)
    Event.get(event.id, for_update=True, db_sess=db_session)
    both = TicketType.add(admin, event, "Both", 0, now, dayOffsets=[0, 1], category=TicketCategory.add(admin, event, "Both", now))
    first = TicketType.add(admin, event, "First", 0, now, dayOffsets=[0], category=TicketCategory.add(admin, event, "First", now))
    db_session.flush()
    ticket = Ticket.new(admin, both, event, "", "", "", "HISTORY")
    db_session.flush()
    Ticket.get(ticket.id, for_update=True, db_sess=db_session)
    ticket.record_checkin(admin, event.days[1], now=now)
    ticket.update(admin, first.id, "", "", "")
    event.update(admin, event.name, event.date, twoDays=False)
    event_id, type_id = event.id, first.id
    with Session(db_session.get_bind()) as session:
        row, = Ticket.stats_for_event(event_id, db_sess=session)
        assert row["typeId"] == type_id and row["scanned"] == row["checkinCount"] == 1
        assert [(day["dayOffset"], day["checkedIn"], day["eligible"]) for day in row["byDay"]] == [(0, 0, 1), (1, 1, 0)]


def test_catalog_serialization_is_batched(db_session: Session, issued: IssuedData):
    from data.ticket_category import TicketCategory

    with Session(db_session.get_bind()) as session, statements(session) as queries:
        result = TicketCategory.catalog_for_event(issued["event"], db_sess=session)
        assert len(queries) <= 5
        assert result["categories"]
        assert all(variant["validDates"] for category in result["categories"] for variant in category["variants"])


def test_empty_ticket_page_does_not_load_an_auth_ticket(app: Flask, db_session: Session, issued: IssuedData):
    from flask import g

    from data.ticket import Ticket, TicketPageJson
    from data.ticket_checkin import TicketCheckin

    with app.test_request_context(), Session(db_session.get_bind()) as session:
        g.db_session = session
        loaded = []
        sa_event.listen(session, "loaded_as_persistent", lambda session, item: loaded.append(type(item)))
        result = Ticket.page_for_event(issued["event"], TicketPageJson(search="not-a-ticket"))
        assert result["hasAuth"] is True and result["items"] == []
        assert Ticket not in loaded and TicketCheckin not in loaded


def test_user_list_serializes_access_and_permissions_without_extra_queries(db_session: Session, admin: User, user_factory: UserFactory):
    from data._roles import Roles
    from data.event import Event
    from data.user import User

    for index in range(6):
        staff = user_factory(f"list-{index}", f"Staff {index}", Roles.clerk, boss_id=admin.id)
        Event.new(staff, f"Event {index}", date(2026, 10, 31))
    boss_id = admin.id
    with Session(db_session.get_bind()) as session:
        boss = User.get(boss_id, db_sess=session)
        with statements(session) as queries:
            users = User.all_staff_for_manager(boss)
        assert len(queries) <= 4
        with statements(session) as serialization_queries:
            data = [user.get_dict_full() for user in users]
        assert not serialization_queries
        assert len(data) == 6
        assert all(user["access"] and user["roles"] and user["operations"] for user in data)


def test_full_event_list_batches_days_and_access(app: Flask, db_session: Session, admin: User, user_factory: UserFactory):
    from flask import g

    from data._roles import Roles
    from data.event import Event

    for index in range(6):
        staff = user_factory(f"event-list-{index}", f"Staff {index}", Roles.clerk, boss_id=admin.id)
        Event.new(staff, f"Event {index}", date(2026, 10, 31))
    with app.test_request_context(), Session(db_session.get_bind()) as session, statements(session) as queries:
        g.db_session = session
        result = Event.all_full_data()
        assert len(queries) <= 5
        assert len(result) == 6
        assert all(len(event["days"]) == len(event["access"]) == 1 for event in result)
        assert all(event["access"][0]["operations"] for event in result)
