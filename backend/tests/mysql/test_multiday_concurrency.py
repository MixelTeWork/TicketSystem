from __future__ import annotations

from typing import TYPE_CHECKING

from data.ticket_category import TicketCategory
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from uuid import uuid4

import pytest

if TYPE_CHECKING:
    from data.user import User
    from fixture_types import JsonValue
    from flask import Flask
    from flask.testing import FlaskClient
    from sqlalchemy.engine import Connection, ExceptionContext, ExecutionContext
    from sqlalchemy.engine.interfaces import DBAPICursor
    from sqlalchemy.orm import Session
    from typing import Any

pytestmark = pytest.mark.mysql


@pytest.fixture(autouse=True)
def require_mysql(app: Flask):
    if app.config["TEST_DB_KIND"] != "mysql":
        pytest.skip("requires production-compatible MySQL locking")


@pytest.fixture
def setup_events(db_session: Session, admin: User):
    from data.event import Event
    from data.ticket_type import TicketType

    result = []
    for index in range(2):
        event = Event.new(admin, f"Concurrent {index}", date(2026, 10, 31), twoDays=True)
        event = Event.get(event.id, for_update=True, db_sess=db_session)
        variant = TicketType.add(admin, event, "Both", 100, datetime(2026, 10, 1), dayOffsets=[0, 1], quantity=1, category=TicketCategory.add(admin, event, "Both", datetime(2026, 10, 1)))
        db_session.commit()
        result.append((event.id, variant.id))
    db_session.rollback()
    return result


def intention(event_type: tuple[int, int], request_id: str | None = None, **values: JsonValue):
    return {
        "eventId": event_type[0],
        "typeId": event_type[1],
        "requestId": request_id or str(uuid4()),
        "personName": "Concurrent visitor",
        "personLink": "",
        "promocode": "",
        "code": "",
        **values,
    }


def requests(app: Flask, path: str, bodies: list[dict[str, JsonValue]], *, method: str = "post"):
    start = threading.Barrier(len(bodies))

    def execute(body: dict[str, JsonValue]):
        with app.test_client() as client:
            assert client.post("/api/auth", json={"login": "admin", "password": "admin"}).status_code == 200
            start.wait(timeout=15)
            response = getattr(client, method)(path, json=body)
            return response.status_code, response.get_json()

    with ThreadPoolExecutor(max_workers=len(bodies)) as executor:
        return list(executor.map(execute, bodies))


def barrier_before_event_lock(monkeypatch: pytest.MonkeyPatch, count: int = 2):
    """Both requests have opened their authorization snapshot before locking."""
    from data.event import Event

    barrier = threading.Barrier(count)
    original = Event.get

    def get(*args: Any, **kwargs: Any):
        if kwargs.get("for_update"):
            barrier.wait(timeout=15)
        return original(*args, **kwargs)

    monkeypatch.setattr(Event, "get", get)


def test_last_place_uses_current_read_after_wait(app: Flask, setup_events: list[tuple[int, int]], monkeypatch: pytest.MonkeyPatch, db_session: Session):
    from data.ticket import Ticket

    barrier_before_event_lock(monkeypatch)
    results = requests(app, "/api/tickets", [intention(setup_events[0]), intention(setup_events[0])])
    assert sorted(status for status, _ in results) == [200, 409]
    warning = next(body for status, body in results if status == 409)
    assert warning["code"] == "ticket_limit_confirmation_required"
    assert warning["details"]["issuedCount"] == 1
    db_session.rollback()
    assert db_session.query(Ticket).count() == 1


def test_concurrent_same_request_and_confirmation_create_once(app: Flask, setup_events: list[tuple[int, int]], logged_in_admin: FlaskClient, monkeypatch: pytest.MonkeyPatch, db_session: Session):
    from bafser import Log

    from data.event import Event
    from data.request_operation import RequestOperation
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    variant = db_session.get(TicketType, setup_events[0][1])
    variant.quantity = 0
    db_session.commit()
    frozen = intention(setup_events[0])
    warning = logged_in_admin.post("/api/tickets", json=frozen)
    assert warning.status_code == 409 and warning.get_json()["code"] == "ticket_limit_confirmation_required"
    barrier_before_event_lock(monkeypatch)
    confirmed = {**frozen, "allowOverLimit": True}
    results = requests(app, "/api/tickets", [confirmed, confirmed])
    assert [status for status, _ in results] == [200, 200]
    assert results[0][1]["id"] == results[1][1]["id"]
    assert results[0][1]["code"] == results[1][1]["code"]
    db_session.rollback()
    assert db_session.query(Ticket).count() == db_session.query(RequestOperation).count() == 1
    assert db_session.query(Log).filter_by(tableName="Ticket", actionCode="added").count() == 1
    # Read directly: the instrumented Event.get barrier belongs to API workers.
    assert db_session.get(Event, setup_events[0][0]).lastTicketNumber == 1


@pytest.mark.parametrize("shared_key", [False, True])
def test_independent_events_and_global_actor_key(app: Flask, setup_events: list[tuple[int, int]], monkeypatch: pytest.MonkeyPatch, db_session: Session, shared_key: bool):
    # A retry must not revisit a one-shot barrier after an InnoDB deadlock.
    from data.event import Event
    from data.request_operation import RequestOperation
    from data.ticket import Ticket

    original = Event.get
    barrier = threading.Barrier(2)
    local = threading.local()

    def get(*args: Any, **kwargs: Any):
        if kwargs.get("for_update") and not getattr(local, "waited", False):
            local.waited = True
            barrier.wait(timeout=15)
        return original(*args, **kwargs)

    monkeypatch.setattr(Event, "get", get)
    key = str(uuid4())
    results = requests(app, "/api/tickets", [intention(pair, key if shared_key else None) for pair in setup_events])
    assert sorted(status for status, _ in results) == ([200, 409] if shared_key else [200, 200])
    if shared_key:
        assert next(body for status, body in results if status == 409)["code"] == "request_id_conflict"
    db_session.rollback()
    assert db_session.query(Ticket).count() == db_session.query(RequestOperation).count() == (1 if shared_key else 2)


@pytest.mark.parametrize("operation", ["entry", "merch"])
def test_scan_waiter_returns_original_full_history(app: Flask, setup_events: list[tuple[int, int]], logged_in_admin: FlaskClient, monkeypatch: pytest.MonkeyPatch, db_session: Session, operation: str):
    from data.ticket import Ticket
    from data.ticket_checkin import TicketCheckin

    response = logged_in_admin.post("/api/tickets", json=intention(setup_events[0]))
    assert response.status_code == 200
    ticket = response.get_json()
    original = Ticket.get_by_code
    barrier = threading.Barrier(2)

    def get_by_code(*args: Any, **kwargs: Any):
        barrier.wait(timeout=15)
        return original(*args, **kwargs)

    monkeypatch.setattr(Ticket, "get_by_code", get_by_code)
    monkeypatch.setattr("blueprints.tickets.get_datetime_utc", lambda: datetime(2026, 10, 31, 12))
    path = "/api/check_ticket" if operation == "entry" else "/api/issue_merch"
    body = {"eventId": setup_events[0][0], "code": ticket["code"]}
    results = requests(app, path, [body, body])
    assert [status for status, _ in results] == [200, 200]
    success = next(result for _, result in results if result["success"])
    rejected = next(result for _, result in results if not result["success"])
    assert rejected["errorCode"] == ("scanned" if operation == "entry" else "merchIssued")
    assert rejected["ticket"] == success["ticket"]
    assert rejected["checkin"] == success["checkin"]
    if operation == "entry":
        assert len(rejected["ticket"]["checkins"]) == 1
        assert rejected["checkin"]["checkedAt"] == "2026-10-31T12:00:00.000000Z"
    else:
        assert rejected["ticket"]["merchIssuedAt"] == "2026-10-31T12:00:00.000000Z"
    db_session.rollback()
    assert db_session.query(TicketCheckin).count() == (1 if operation == "entry" else 0)


def test_replay_reads_scan_committed_while_waiting(app: Flask, setup_events: list[tuple[int, int]], logged_in_admin: FlaskClient, monkeypatch: pytest.MonkeyPatch):
    from bafser import db_session as sessions

    from data.event_day import EventDay
    from data.ticket import Ticket
    from data.user import User

    frozen = intention(setup_events[0])
    ticket = logged_in_admin.post("/api/tickets", json=frozen).get_json()
    held = sessions.create_session()
    locked = Ticket.get(ticket["id"], for_update=True, db_sess=held)
    actor = User.get(1, db_sess=held)
    day = held.query(EventDay).filter_by(eventId=setup_events[0][0], dayOffset=0).one()
    locked.record_checkin(actor, day, now=datetime(2026, 10, 31, 12), commit=False)
    reached = threading.Event()
    original = Ticket.get

    def get(*args: Any, **kwargs: Any):
        if kwargs.get("for_update"):
            reached.set()
        return original(*args, **kwargs)

    monkeypatch.setattr(Ticket, "get", get)
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(lambda: requests(app, "/api/tickets", [frozen])[0])
            assert reached.wait(timeout=15)
            held.commit()
            status, result = future.result(timeout=20)
        assert status == 200 and result["id"] == ticket["id"]
        assert len(result["checkins"]) == 1
    finally:
        held.rollback()
        held.close()


def test_period_shrink_and_second_day_issue_are_serialized(app: Flask, setup_events: list[tuple[int, int]], monkeypatch: pytest.MonkeyPatch, db_session: Session):
    from data.event import Event
    from data.ticket import Ticket

    barrier_before_event_lock(monkeypatch)
    event_id = setup_events[0][0]
    operations = [
        ("/api/tickets", intention(setup_events[0])),
        (f"/api/events/{event_id}", {"name": "Shortened", "date": "2026-10-31T15:00:00Z", "twoDays": False}),
    ]

    def perform(operation: str):
        with app.test_client() as client:
            assert client.post("/api/auth", json={"login": "admin", "password": "admin"}).status_code == 200
            response = client.post(operation[0], json=operation[1])
            return response.status_code, response.get_json()

    with ThreadPoolExecutor(max_workers=2) as executor:
        issue, shrink = list(executor.map(perform, operations))
    assert sorted([issue[0], shrink[0]]) == [200, 409]
    db_session.rollback()
    event = db_session.get(Event, event_id)
    if issue[0] == 200:
        assert shrink[1]["code"] == "event_days_in_use" and event.day_count == 2
        assert db_session.query(Ticket).count() == 1
    else:
        assert issue[1]["code"] == "variant_unavailable" and event.day_count == 1
        assert db_session.query(Ticket).count() == 0


def test_restoration_and_shrink_cannot_leave_invalid_live_ticket(app: Flask, setup_events: list[tuple[int, int]], logged_in_admin: FlaskClient, monkeypatch: pytest.MonkeyPatch, db_session: Session):
    from bafser import db_session as sessions

    from data.event import Event
    from data.ticket import Ticket
    from data.user import User

    ticket = logged_in_admin.post("/api/tickets", json=intention(setup_events[0])).get_json()
    assert logged_in_admin.delete(f"/api/tickets/{ticket['id']}").status_code == 200
    barrier_before_event_lock(monkeypatch)

    def restore():
        with sessions.create_session() as session:
            actor = User.get(1, db_sess=session)
            item = Ticket.get(ticket["id"], includeDeleted=True, db_sess=session)
            result = item.restore(actor, db_sess=session)
            session.commit()
            return result

    def shrink():
        with app.test_client() as client:
            assert client.post("/api/auth", json={"login": "admin", "password": "admin"}).status_code == 200
            response = client.post(f"/api/events/{setup_events[0][0]}", json={"name": "Shortened", "date": "2026-10-31T15:00:00Z", "twoDays": False})
            return response.status_code, response.get_json()

    with ThreadPoolExecutor(max_workers=2) as executor:
        restoration = executor.submit(restore)
        reduction = executor.submit(shrink)
        restored = restoration.result(timeout=25)
        reduced = reduction.result(timeout=25)
    db_session.rollback()
    final_event = db_session.get(Event, setup_events[0][0])
    final_ticket = db_session.get(Ticket, ticket["id"])
    if restored:
        assert reduced[0] == 409 and reduced[1]["code"] == "event_days_in_use"
        assert final_event.day_count == 2 and not final_ticket.deleted
    else:
        assert reduced[0] == 200 and final_event.day_count == 1 and final_ticket.deleted


@pytest.mark.parametrize("operation", ["entry", "merch"])
def test_scanner_sees_type_created_and_assigned_after_authorization(app: Flask, setup_events: list[tuple[int, int]], logged_in_admin: FlaskClient, monkeypatch: pytest.MonkeyPatch, operation: str):
    from bafser import db_session as sessions

    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType
    from data.user import User

    ticket = logged_in_admin.post("/api/tickets", json=intention(setup_events[0])).get_json()
    reached = threading.Event()
    resume = threading.Event()
    original = Ticket.get_by_code

    def get_by_code(*args: Any, **kwargs: Any):
        reached.set()
        assert resume.wait(timeout=20)
        return original(*args, **kwargs)

    monkeypatch.setattr(Ticket, "get_by_code", get_by_code)
    monkeypatch.setattr("blueprints.tickets.get_datetime_utc", lambda: datetime(2026, 10, 31, 12))
    path = "/api/check_ticket" if operation == "entry" else "/api/issue_merch"
    body = {"eventId": setup_events[0][0], "code": ticket["code"]}
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(lambda: requests(app, path, [body])[0])
            assert reached.wait(timeout=15)
            with sessions.create_session() as session:
                actor = User.get(1, db_sess=session)
                event = Event.get(setup_events[0][0], for_update=True, db_sess=session)
                variant = TicketType.add(actor, event, "Brand new type", 200, datetime(2026, 10, 31, 12), dayOffsets=[0, 1], category=TicketCategory.add(actor, event, "Brand new type", datetime(2026, 10, 31, 12)))
                session.flush()
                item = Ticket.get(ticket["id"], for_update=True, db_sess=session)
                item.update(actor, variant.id, "Transferred", "", "")
                session.commit()
                variant_id = variant.id
            resume.set()
            status, result = future.result(timeout=25)
        assert status == 200 and result["success"]
        assert result["ticket"]["typeId"] == variant_id
        assert result["ticket"]["type"] == "Brand new type"
        assert result["ticket"]["dayOffsets"] == [0, 1]
    finally:
        resume.set()


def test_different_tickets_can_enter_concurrently_without_checkin_gap_lock(app: Flask, setup_events: list[tuple[int, int]], logged_in_admin: FlaskClient, monkeypatch: pytest.MonkeyPatch):
    from data.ticket import Ticket

    tickets = [logged_in_admin.post("/api/tickets", json=intention(setup_events[0], allowOverLimit=True)).get_json() for _ in range(2)]
    reached = threading.Barrier(2)
    original = Ticket.get_by_code

    def get_by_code(*args: Any, **kwargs: Any):
        reached.wait(timeout=15)
        return original(*args, **kwargs)

    monkeypatch.setattr(Ticket, "get_by_code", get_by_code)
    monkeypatch.setattr("blueprints.tickets.get_datetime_utc", lambda: datetime(2026, 10, 31, 12))
    results = requests(app, "/api/check_ticket", [{"eventId": setup_events[0][0], "code": item["code"]} for item in tickets])
    assert [status for status, _ in results] == [200, 200]
    assert all(body["success"] and len(body["ticket"]["checkins"]) == 1 for _, body in results)


@pytest.mark.parametrize("mutation", ["create", "shrink"])
@pytest.mark.parametrize("day_offset", [0, 1])
def test_scanning_does_not_deadlock_with_quota_or_period_checks(app: Flask, setup_events: list[tuple[int, int]], logged_in_admin: FlaskClient, monkeypatch: pytest.MonkeyPatch, db_session: Session, mutation: str, day_offset: int):
    import re

    from sqlalchemy import event as sa_event

    from data.ticket import Ticket
    from data.ticket_type import TicketType

    ticket = logged_in_admin.post("/api/tickets", json=intention(setup_events[0])).get_json()
    db_session.get(TicketType, setup_events[0][1]).quantity = 2
    db_session.commit()
    locked = threading.Event()
    checking_tickets = threading.Event()
    worker = threading.local()
    deadlocks = []
    original = Ticket.get_by_code
    engine = db_session.get_bind()

    def get_by_code(*args: Any, **kwargs: Any):
        result = original(*args, **kwargs)
        locked.set()
        assert checking_tickets.wait(timeout=20)
        return result

    def before_sql(connection: Connection, cursor: DBAPICursor, statement: str, parameters: object, context: ExecutionContext, executemany: bool):
        if getattr(worker, "mutating", False) and "FOR UPDATE" in statement and re.search(r"\bFROM\s+`?Ticket`?(?:\s|$)", statement):
            checking_tickets.set()

    def on_error(context: ExceptionContext):
        if getattr(context.original_exception, "args", [None])[0] == 1213:
            deadlocks.append(context.original_exception)

    def mutate():
        worker.mutating = True
        path, body = (
            ("/api/tickets", intention(setup_events[0]))
            if mutation == "create"
            else (f"/api/events/{setup_events[0][0]}", {"name": "Shortened", "date": "2026-10-31T15:00:00Z", "twoDays": False})
        )
        with app.test_client() as client:
            assert client.post("/api/auth", json={"login": "admin", "password": "admin"}).status_code == 200
            response = client.post(path, json=body)
            return response.status_code, response.get_json()

    monkeypatch.setattr(Ticket, "get_by_code", get_by_code)
    monkeypatch.setattr("blueprints.tickets.get_datetime_utc", lambda: datetime(2026, 10, 31, 12) + timedelta(days=day_offset))
    sa_event.listen(engine, "before_cursor_execute", before_sql)
    sa_event.listen(engine, "handle_error", on_error)
    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            scan = executor.submit(lambda: requests(app, "/api/check_ticket", [{"eventId": setup_events[0][0], "code": ticket["code"]}])[0])
            assert locked.wait(timeout=20)
            change = executor.submit(mutate)
            scan_status, scanned = scan.result(timeout=30)
            change_status, changed = change.result(timeout=30)
        assert scan_status == 200 and scanned["success"]
        assert change_status == (200 if mutation == "create" else 409)
        if mutation == "shrink":
            assert changed["code"] == "event_days_in_use"
        assert not deadlocks, "EventDay foreign-key locks must not form a Ticket/Day cycle"
    finally:
        checking_tickets.set()
        sa_event.remove(engine, "before_cursor_execute", before_sql)
        sa_event.remove(engine, "handle_error", on_error)


@pytest.mark.parametrize("action", ["update", "delete"])
def test_catalog_waiter_sees_category_created_after_authorization(app: Flask, setup_events: list[tuple[int, int]], monkeypatch: pytest.MonkeyPatch, db_session: Session, action: str):
    from bafser import db_session as sessions

    from data.event import Event
    from data.ticket_type import TicketType
    from data.user import User

    event_id = setup_events[0][0]
    reached = threading.Event()
    original = Event.get
    writer_thread = threading.current_thread()

    def get(*args: Any, **kwargs: Any):
        if kwargs.get("for_update") and threading.current_thread() is not writer_thread:
            # protected_route has already established the reader's RR snapshot.
            reached.set()
        return original(*args, **kwargs)

    monkeypatch.setattr(Event, "get", get)
    with sessions.create_session() as held:
        actor = User.get(1, db_sess=held)
        event = Event.get(event_id, for_update=True, db_sess=held)
        category = TicketCategory.add(actor, event, "New concurrent category", datetime(2026, 10, 31))
        variant = TicketType.add(actor, event, "New concurrent variant", 25, datetime(2026, 10, 31),
                                 category=category, dayOffsets=[0])
        held.flush()
        variant_id = variant.id
        change = {"action": action, "id": variant_id}
        if action == "update":
            change["name"] = "Updated after waiting"
        body = {"categoryChanges": [], "typeChanges": [change]}
        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(lambda: requests(app, f"/api/events/{event_id}/ticket_types", [body])[0])
                assert reached.wait(timeout=20)
                held.commit()
                status, result = future.result(timeout=25)
            assert status == 200, result
        finally:
            held.rollback()
    db_session.rollback()
    final = TicketType.get(variant_id, includeDeleted=True, db_sess=db_session)
    assert final.deleted is (action == "delete")
    assert final.name == ("Updated after waiting" if action == "update" else "New concurrent variant")


@pytest.mark.parametrize("mutation", ["variant_delete", "category_delete", "design", "event_delete"])
def test_catalog_waiter_retires_image_created_after_authorization(app: Flask, setup_events: list[tuple[int, int]], monkeypatch: pytest.MonkeyPatch, db_session: Session, mutation: str):
    import base64

    from bafser import db_session as sessions

    from data.event import Event
    from data.img import Image
    from data.ticket_type import TicketType
    from data.user import User

    event_id, variant_id = setup_events[0]
    reached = threading.Event()
    original = Event.get
    writer_thread = threading.current_thread()

    def get(*args: Any, **kwargs: Any):
        if kwargs.get("for_update") and threading.current_thread() is not writer_thread:
            reached.set()
        return original(*args, **kwargs)

    monkeypatch.setattr(Event, "get", get)
    payload = {"name": "Concurrent image", "accessEventId": event_id,
               "data": "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\nconcurrent").decode()}
    pattern = {"width": 20, "height": 30, "objects": []}
    with sessions.create_session() as held:
        actor = User.get(1, db_sess=held)
        event = Event.get(event_id, for_update=True, db_sess=held)
        if mutation == "event_delete":
            # The collection itself must see a variant absent from the old
            # snapshot, rather than only refreshing an existing image FK.
            category = TicketCategory.add(actor, event, "New category before event deletion", datetime(2026, 10, 31))
            variant = TicketType.add(actor, event, "New type before event deletion", 50, datetime(2026, 10, 31),
                                     category=category, dayOffsets=[0])
            held.flush()
            variant_id = variant.id
        else:
            variant = TicketType.get(variant_id, for_update=True, db_sess=held)
        with app.app_context():
            image = Image.new(actor, payload, commit=False)
        image_id = image.id
        variant.update_design(actor, pattern, image)
        if mutation == "event_delete":
            path = f"/api/events/{event_id}"
            body = {}
        elif mutation == "design":
            path = f"/api/ticket_types/{variant_id}"
            body = {"img": {**payload, "name": "Next image"}, "pattern": {**pattern, "width": 40}}
        else:
            path = f"/api/events/{event_id}/ticket_types"
            body = {"categoryChanges": [], "typeChanges": []}
            if mutation == "category_delete":
                body["categoryChanges"] = [{"action": "delete", "id": variant.categoryId}]
            else:
                body["typeChanges"] = [{"action": "delete", "id": variant_id}]
        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(lambda: requests(app, path, [body], method="delete" if mutation == "event_delete" else "post")[0])
                assert reached.wait(timeout=20)
                held.commit()
                status, result = future.result(timeout=25)
            assert status == 200, result
        finally:
            held.rollback()
    db_session.rollback()
    assert Image.get(image_id, includeDeleted=True, db_sess=db_session).deleted
    final = TicketType.get(variant_id, includeDeleted=True, db_sess=db_session)
    if mutation == "event_delete":
        assert Event.get(event_id, includeDeleted=True, db_sess=db_session).deleted
        assert not final.deleted  # Event deletion preserves its catalog history.
    elif mutation == "design":
        assert not final.deleted and final.imageId != image_id and final.pattern["width"] == 40
        assert not Image.get(final.imageId, db_sess=db_session).deleted
    else:
        assert final.deleted
