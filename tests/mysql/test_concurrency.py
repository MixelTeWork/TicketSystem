from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import threading
import time

import pytest


pytestmark = pytest.mark.mysql


@pytest.fixture(autouse=True)
def require_mysql(app):
    if app.config["TEST_DB_KIND"] != "mysql":
        pytest.skip("requires production-compatible MySQL locking")


@pytest.fixture
def concurrent_ticket(db_session, admin):
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    event = Event.new(admin, "Concurrent scan", datetime(2026, 9, 26, 18, 0))
    ticket_type, _ = TicketType.add(
        admin, event, "Standard", None, datetime(2026, 9, 1, 12, 0)
    )
    db_session.commit()
    ticket, error = Ticket.new(
        admin, ticket_type, event, "Person", "", "", "CONCURRENT-SCAN"
    )
    assert error is None
    db_session.commit()
    return event.id, ticket.code


def test_only_one_concurrent_scan_is_accepted(
    app, concurrent_ticket, monkeypatch
):
    import blueprints.tickets as tickets_blueprint
    from bafser import get_datetime_now as real_now

    event_id, code = concurrent_ticket
    start = threading.Barrier(2)

    def slow_now():
        time.sleep(0.2)
        return real_now()

    monkeypatch.setattr(tickets_blueprint, "get_datetime_now", slow_now)

    def scan():
        with app.test_client() as thread_client:
            start.wait(timeout=5)
            return thread_client.post(
                "/api/check_ticket", json={"eventId": event_id, "code": code}
            ).get_json()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: scan(), range(2)))

    assert sorted(result["success"] for result in results) == [False, True]
    assert {result["errorCode"] for result in results} == {None, "scanned"}


def test_concurrent_automatic_codes_are_unique(db_session, admin):
    from bafser import db_session as session_factory
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType
    from data.user import User

    event = Event.new(admin, "Concurrent codes", datetime(2026, 9, 26, 18, 0))
    ticket_type, _ = TicketType.add(
        admin, event, "Standard", None, datetime(2026, 9, 1, 12, 0)
    )
    db_session.commit()
    event_id = event.id
    type_id = ticket_type.id
    admin_id = admin.id
    start = threading.Barrier(4)

    def create_ticket(index):
        session = session_factory.create_session()
        try:
            actor = session.get(User, admin_id)
            start.wait(timeout=5)
            locked_event = session.get(Event, event_id, with_for_update=True)
            current_type = session.get(TicketType, type_id)
            ticket, error = Ticket.new(
                actor, current_type, locked_event, "Person {}".format(index), "", "", ""
            )
            assert error is None
            session.commit()
            return ticket.code
        finally:
            session.close()

    with ThreadPoolExecutor(max_workers=4) as executor:
        codes = list(executor.map(create_ticket, range(4)))

    assert len(codes) == len(set(codes)) == 4
    # End the fixture session's original REPEATABLE READ snapshot before
    # observing commits made by the worker sessions.
    db_session.rollback()
    db_session.expire_all()
    assert db_session.get(Event, event_id).lastTicketNumber == 4
