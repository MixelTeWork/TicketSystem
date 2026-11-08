from __future__ import annotations

from typing import TYPE_CHECKING

import base64
from datetime import date, datetime
from uuid import uuid4

import pytest
import sqlalchemy as sa
from factories import single_day_variant
from sqlalchemy.exc import DBAPIError

if TYPE_CHECKING:
    from data.user import User
    from fixture_types import JsonValue, Login, ManagerContext, UserFactory
    from flask import Flask
    from flask.testing import FlaskClient
    from sqlalchemy.orm import Session


def single_day_catalog(changes: list[dict[str, JsonValue]]):
    categories = []
    variants = []
    for index, values in enumerate(changes):
        change = dict(values)
        if change["action"] == "add":
            client_id = f"category-{index}"
            categories.append({"action": "add", "clientId": client_id, "name": "New category"})
            change.pop("id", None)
            change.update(categoryRef={"clientId": client_id}, dayOffsets=[0])
        elif change["action"] == "delete":
            change = {key: value for key, value in change.items() if key in {"action", "id"}}
        variants.append(change)
    return {"categoryChanges": categories, "typeChanges": variants}


@pytest.fixture
def manager_context(db_session: Session, user_factory: UserFactory, login: Login):
    from data._roles import Roles
    from data.event import Event

    manager = user_factory("manager", "Manager", Roles.manager)
    event = Event.new(manager, "API event", date(2026, 9, 26))
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket_type = single_day_variant(manager, event, "Standard", 1000, datetime(2026, 9, 1, 12, 0))
    db_session.commit()
    client = login("manager")
    return client, manager, event, ticket_type


def test_model_queries_use_request_session_or_explicit_session(app: Flask, db_session: Session, admin: User):
    from data.event import Event
    from data.ticket_type import TicketType
    from data.user import User

    event = Event.new(admin, "Query event", date(2027, 1, 1))
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket_type = single_day_variant(admin, event, "Standard", 100, datetime(2026, 9, 1, 12, 0))
    db_session.commit()

    assert Event.get(event.id, db_sess=db_session).name == "Query event"
    assert TicketType.all_for_event(event.id, db_sess=db_session)[0].id == ticket_type.id
    assert User.get_by_login("admin", includeDeleted=True, db_sess=db_session).id == admin.id

    with app.test_request_context():
        assert Event.get(event.id).name == "Query event"
        assert TicketType.all_for_event(event.id)[0].id == ticket_type.id
        assert User.get_by_login("admin").id == admin.id


def test_event_create_update_and_delete_contract(manager_context: ManagerContext):
    client, _, _, _ = manager_context

    created = client.post(
        "/api/events",
        json={"name": "New event", "date": "2027-01-02T15:30:00"},
    )
    event_id = created.get_json()["id"]
    updated = client.post(
        "/api/events/{}".format(event_id),
        json={"name": "Renamed", "date": "2027-01-03T16:45:00"},
    )
    deleted = client.delete("/api/events/{}".format(event_id))

    assert created.status_code == 200
    assert set(created.get_json()) == {"id", "name", "date", "active", "endDate", "dayCount", "days"}
    assert created.get_json()["active"] is True
    assert updated.status_code == 200
    assert updated.get_json()["name"] == "Renamed"
    assert updated.get_json()["active"] is True
    assert deleted.status_code == 200
    assert deleted.get_json() == {"msg": "ok"}
    missing = client.get("/api/events/{}".format(event_id))
    assert missing.status_code == 400
    assert missing.get_json() == {"msg": "Event with 'eventId={}' not found".format(event_id)}


def test_event_update_without_active_preserves_disabled_scanning(manager_context: ManagerContext):
    client, _, event, _ = manager_context
    url = f"/api/events/{event.id}"
    disabled = client.post(url, json={"name": event.name, "date": "2026-09-26T18:00:00Z", "active": False})
    assert disabled.status_code == 200
    assert disabled.get_json()["active"] is False

    updated = client.post(url, json={"name": "Renamed", "date": "2026-09-27T18:00:00Z"})
    assert updated.status_code == 200
    assert updated.get_json()["active"] is False
    assert client.get(url).get_json() == updated.get_json()


@pytest.mark.parametrize("active", [None, 0, 1, "false", [], {}])
def test_event_update_rejects_non_boolean_active_without_changes(manager_context: ManagerContext, active: JsonValue):
    client, _, event, _ = manager_context
    url = f"/api/events/{event.id}"
    before = client.get(url).get_json()
    response = client.post(url, json={"name": "Rejected", "date": "2027-01-03T16:45:00Z", "active": active})
    assert response.status_code == 400
    assert client.get(url).get_json() == before


@pytest.mark.parametrize("price", ["100", 1.5, True, [], {}])
def test_ticket_rejects_non_integer_price(manager_context: ManagerContext, price: JsonValue):
    client, _, event, ticket_type = manager_context

    response = client.post(
        "/api/tickets",
        json={
            "requestId": str(uuid4()),
            "eventId": event.id,
            "typeId": ticket_type.id,
            "personName": "Person",
            "personLink": "",
            "promocode": "",
            "code": "PRICE-{}".format(type(price).__name__),
            "price": price,
        },
    )

    # `bool` is deliberately characterized: Python's exact-type check rejects it.
    assert response.status_code == 400
    assert "price" in response.get_json()["msg"]


def test_ticket_rejects_negative_price(manager_context: ManagerContext):
    client, _, event, ticket_type = manager_context

    response = client.post(
        "/api/tickets",
        json={
            "requestId": str(uuid4()),
            "eventId": event.id,
            "typeId": ticket_type.id,
            "personName": "Person",
            "personLink": "",
            "promocode": "",
            "code": "NEGATIVE-PRICE",
            "price": -1,
        },
    )

    assert response.status_code == 400
    assert "price" in response.get_json()["msg"]


@pytest.mark.parametrize("price", [2147483648, 10**30])
def test_ticket_rejects_out_of_range_price_without_partial_creation(manager_context: ManagerContext, db_session: Session, price: int):
    from bafser import Log

    from data.event import Event
    from data.request_operation import RequestOperation
    from data.ticket import Ticket

    client, _, event, ticket_type = manager_context
    event_id = event.id
    counter = event.lastTicketNumber
    log_count = db_session.query(Log).count()
    response = client.post("/api/tickets", json={
        "requestId": str(uuid4()), "eventId": event_id, "typeId": ticket_type.id,
        "personName": "Rejected", "personLink": "", "promocode": "", "code": "", "price": price,
    })

    assert response.status_code == 400
    assert "price" in response.get_json()["msg"]
    db_session.rollback()
    assert db_session.query(Ticket).count() == 0
    assert db_session.query(RequestOperation).count() == 0
    assert db_session.query(Log).count() == log_count
    assert Event.get(event_id, db_sess=db_session).lastTicketNumber == counter


def test_ticket_update_rejects_out_of_range_price_without_changes(manager_context: ManagerContext, db_session: Session):
    from bafser import Log

    client, _, event, ticket_type = manager_context
    created = client.post("/api/tickets", json={
        "requestId": str(uuid4()), "eventId": event.id, "typeId": ticket_type.id,
        "personName": "Original", "personLink": "", "promocode": "", "code": "", "price": 100,
    })
    assert created.status_code == 200
    db_session.rollback()
    before = client.get(f"/api/events/{event.id}/tickets").get_json()
    log_count = db_session.query(Log).count()

    response = client.post(f"/api/tickets/{created.get_json()['id']}", json={
        "typeId": ticket_type.id, "personName": "Rejected", "personLink": "changed", "promocode": "changed", "price": 2147483648,
    })

    assert response.status_code == 400
    assert "price" in response.get_json()["msg"]
    assert client.get(f"/api/events/{event.id}/tickets").get_json() == before
    db_session.rollback()
    assert db_session.query(Log).count() == log_count


@pytest.mark.parametrize("price", [None, 0, 2147483647])
def test_ticket_create_and_update_accept_storage_price_boundaries(manager_context: ManagerContext, price: int | None):
    client, _, event, ticket_type = manager_context
    response = client.post("/api/tickets", json={
        "requestId": str(uuid4()), "eventId": event.id, "typeId": ticket_type.id,
        "personName": "Person", "personLink": "", "promocode": "", "code": "", "price": price,
    })
    assert response.status_code == 200
    assert response.get_json()["price"] == price
    updated = client.post(f"/api/tickets/{response.get_json()['id']}", json={
        "typeId": ticket_type.id, "personName": "Updated", "personLink": "", "promocode": "", "price": price,
    })
    assert updated.status_code == 200
    assert updated.get_json()["price"] == price


def test_database_rejects_negative_counters_and_prices(manager_context: ManagerContext, db_session: Session):
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    _, manager, event, ticket_type = manager_context
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket = Ticket.new(manager, ticket_type, event, "Person", "", "", "CONSTRAINT", None)
    db_session.commit()

    for model, row_id, column in (
        (Event, event.id, "lastTicketNumber"),
        (Event, event.id, "lastTypeNumber"),
        (TicketType, ticket_type.id, "number"),
        (TicketType, ticket_type.id, "price"),
        (Ticket, ticket.id, "price"),
    ):
        with pytest.raises(DBAPIError):
            with db_session.begin_nested():
                db_session.execute(sa.update(model).where(model.id == row_id).values({column: -1}))


@pytest.mark.parametrize("field, value", [("personName", "x" * 257), ("code", "x" * 33)])
def test_ticket_rejects_values_longer_than_database_columns(manager_context: ManagerContext, field: str, value: JsonValue):
    client, _, event, ticket_type = manager_context
    payload = {
        "requestId": str(uuid4()),
        "eventId": event.id,
        "typeId": ticket_type.id,
        "personName": "Person",
        "personLink": "",
        "promocode": "",
        "code": "VALID-CODE",
    }
    payload[field] = value

    response = client.post("/api/tickets", json=payload)

    assert response.status_code == 400
    assert field in response.get_json()["msg"]
    assert client.get(f"/api/events/{event.id}/tickets").get_json() == []


def test_ticket_lifecycle_and_statistics(manager_context: ManagerContext):
    client, _, event, ticket_type = manager_context
    payload = {
        "requestId": str(uuid4()),
        "eventId": event.id,
        "typeId": ticket_type.id,
        "personName": "Person",
        "personLink": "https://example.test",
        "promocode": "PROMO",
        "code": "API-CODE",
        "price": 900,
    }

    created = client.post("/api/tickets", json=payload)
    ticket_id = created.get_json()["id"]
    listed = client.get("/api/events/{}/tickets".format(event.id))
    stats_before = client.get("/api/events/{}/tickets_stats".format(event.id))
    scanned = client.post("/api/check_ticket", json={"eventId": event.id, "code": "API-CODE"})
    stats_after = client.get("/api/events/{}/tickets_stats".format(event.id))
    deleted = client.delete("/api/tickets/{}".format(ticket_id))

    assert created.status_code == 200
    assert created.get_json()["price"] == 900
    assert [item["id"] for item in listed.get_json()] == [ticket_id]
    assert [{key: row[key] for key in ("typeId", "count", "scanned", "authOnPltf")} for row in stats_before.get_json()] == [
        {"typeId": ticket_type.id, "count": 1, "scanned": 0, "authOnPltf": 0}
    ]
    assert scanned.get_json()["success"] is True
    assert stats_after.get_json()[0]["scanned"] == 1
    assert deleted.get_json() == {"msg": "ok"}
    assert client.get("/api/events/{}/tickets".format(event.id)).get_json() == []


def test_ticket_update_contract(manager_context: ManagerContext):
    client, _, event, ticket_type = manager_context
    created = client.post(
        "/api/tickets",
        json={
            "requestId": str(uuid4()),
            "eventId": event.id,
            "typeId": ticket_type.id,
            "personName": "Before",
            "personLink": "before",
            "promocode": "OLD",
            "code": "UPDATE-API",
            "price": None,
        },
    ).get_json()

    response = client.post(
        "/api/tickets/{}".format(created["id"]),
        json={
            "typeId": ticket_type.id,
            "personName": "After",
            "personLink": "after",
            "promocode": "NEW",
            "price": 123,
        },
    )

    assert response.status_code == 200
    assert response.get_json()["personName"] == "After"
    assert response.get_json()["price"] == 123


def test_ticket_type_list_batch_update_and_design(manager_context: ManagerContext, db_session: Session):
    from bafser import Log

    client, _, event, original = manager_context
    original_dict = original.get_dict()

    listed = client.get("/api/events/{}/ticket_types".format(event.id))
    changed = client.post(
        "/api/events/{}/ticket_types".format(event.id),
        json=single_day_catalog(
            [
                {
                    "action": "update",
                    "id": original.id,
                    "name": "Renamed",
                    "price": 1100,
                },
                {"action": "add", "name": "VIP", "price": 2500},
            ]
        ),
    )
    vip = next(item for category in changed.get_json()["categories"] for item in category["variants"] if item["name"] == "VIP")
    image = base64.b64encode(b"\x89PNG\r\n\x1a\nticket-background").decode("ascii")
    designed = client.post(
        "/api/ticket_types/{}".format(vip["id"]),
        json={
            "pattern": {"width": 1280, "height": 720, "objects": []},
            "img": {
                "name": "background",
                "data": "data:image/png;base64," + image,
                "accessEventId": event.id,
            },
        },
    )
    db_session.rollback()
    type_log = db_session.query(Log).filter_by(tableName="TicketType", recordId=vip["id"], actionCode="updated").order_by(Log.id.desc()).first()
    image_log = db_session.query(Log).filter_by(tableName="Image", recordId=designed.get_json()["imageId"], actionCode="added").one()
    replaced = client.post(
        "/api/ticket_types/{}".format(vip["id"]),
        json={
            "pattern": {"width": 640, "height": 360, "objects": []},
            "img": {
                "name": "replacement",
                "data": "data:image/png;base64," + image,
                "accessEventId": event.id,
            },
        },
    )
    db_session.rollback()
    replacement_log = (
        db_session.query(Log).filter_by(tableName="TicketType", recordId=vip["id"], actionCode="updated").order_by(Log.id.desc()).first()
    )
    replacement_changes = {field: (old, new) for field, old, new in replacement_log.changes}
    fetched = client.get("/api/ticket_types/{}".format(vip["id"]))
    after_delete = client.post(
        "/api/events/{}/ticket_types".format(event.id),
        json=single_day_catalog(
            [
                {
                    "action": "delete",
                    "id": vip["id"],
                    "name": "VIP",
                    "price": 2500,
                }
            ]
        ),
    )

    assert listed.get_json() == [original_dict]
    assert designed.status_code == 200
    assert designed.get_json()["imageId"] is not None
    assert {change[0] for change in type_log.changes} == {"pattern", "imageId"}
    assert {change[0] for change in image_log.changes} >= {"name", "type", "accessEventId"}
    assert replaced.status_code == 200
    assert replaced.get_json()["imageId"] != designed.get_json()["imageId"]
    assert replacement_changes["imageId"] == (designed.get_json()["imageId"], replaced.get_json()["imageId"])
    assert replacement_changes["pattern"] == (designed.get_json()["pattern"], replaced.get_json()["pattern"])
    assert fetched.get_json() == replaced.get_json()
    assert [item["name"] for category in after_delete.get_json()["categories"] for item in category["variants"] if item["available"]] == ["Renamed"]


@pytest.mark.parametrize("date", ["not-a-date", 123, None])
def test_event_rejects_invalid_date(manager_context: ManagerContext, date: str | int | None):
    client, _, _, _ = manager_context
    response = client.post("/api/events", json={"name": "Invalid", "date": date})
    assert response.status_code == 400
    assert response.get_json() == {"msg": "date is not a valid date" if isinstance(date, str) else "date is not str"}


def test_ticket_type_must_belong_to_ticket_event(manager_context: ManagerContext, db_session: Session):
    client, manager, event, _ = manager_context
    from data.event import Event
    from data.ticket_type import TicketType

    other_event = Event.new(manager, "Other", date(2026, 10, 1))
    Event.get(other_event.id, for_update=True, db_sess=other_event.db_sess)
    other_type = single_day_variant(manager, other_event, "Other type", None, datetime(2026, 9, 1, 12, 0))
    db_session.commit()

    response = client.post(
        "/api/tickets",
        json={
            "requestId": str(uuid4()),
            "eventId": event.id,
            "typeId": other_type.id,
            "personName": "",
            "personLink": "",
            "promocode": "",
            "code": "WRONG-TYPE",
        },
    )

    assert response.status_code == 400
    assert "is for another event" in response.get_json()["msg"]


def test_ticket_type_batch_is_rolled_back_on_later_error(manager_context: ManagerContext, db_session: Session):
    client, _, event, _ = manager_context
    from data.ticket_type import TicketType

    response = client.post(
        "/api/events/{}/ticket_types".format(event.id),
        json=single_day_catalog(
            [
                {"action": "add", "name": "Must roll back", "price": 100},
                {"action": "unsupported", "name": "Broken", "price": None},
            ]
        ),
    )

    db_session.expire_all()
    names = [item.name for item in TicketType.all_for_event(event.id, db_sess=db_session)]
    assert response.status_code == 400
    assert names == ["Standard"]


def test_event_access_is_enforced_even_when_role_allows_route(client: FlaskClient, login: Login, user_factory: UserFactory, db_session: Session, admin: User):
    from data._roles import Roles
    from data.event import Event

    user_factory("manager", "Manager", Roles.manager)
    event = Event.new(admin, "Private", date(2026, 9, 26))
    db_session.commit()
    login("manager")

    response = client.get("/api/events/{}".format(event.id))

    assert response.status_code == 403
    assert response.get_json() == {"msg": "No permission"}


def test_event_missing_and_duplicate_access_errors(manager_context: ManagerContext):
    client, _, event, _ = manager_context

    fetched = client.get("/api/events/{}".format(event.id))
    missing_scanner = client.get("/api/scanner_events/999999")
    missing_update = client.post(
        "/api/events/999999",
        json={"name": "Missing", "date": "2027-01-01T12:00:00"},
    )
    missing_delete = client.delete("/api/events/999999")
    assert fetched.status_code == 200
    assert fetched.get_json()["id"] == event.id
    assert missing_scanner.status_code == 403  # access decorator runs first
    assert missing_update.status_code == 403  # access decorator runs first
    assert missing_delete.status_code == 403


def test_deleted_event_update_delete_and_ticket_type_errors(manager_context: ManagerContext):
    client, _, event, _ = manager_context
    assert client.delete("/api/events/{}".format(event.id)).status_code == 200

    invalid_date = client.post(
        "/api/events/{}".format(event.id),
        json={"name": "Still deleted", "date": "invalid"},
    )
    missing_update = client.post(
        "/api/events/{}".format(event.id),
        json={"name": "Still deleted", "date": "2027-01-01T12:00:00"},
    )
    missing_delete = client.delete("/api/events/{}".format(event.id))
    missing_batch = client.post("/api/events/{}/ticket_types".format(event.id), json=single_day_catalog([]))

    assert invalid_date.status_code == 400
    assert invalid_date.get_json() == {"msg": "date is not a valid date"}
    assert missing_update.status_code == 400
    assert "not found" in missing_update.get_json()["msg"]
    assert missing_delete.status_code == 400
    assert "not found" in missing_delete.get_json()["msg"]
    assert missing_batch.status_code == 400
    assert "not found" in missing_batch.get_json()["msg"]


def test_admin_can_list_full_events(logged_in_admin: FlaskClient):
    response = logged_in_admin.get("/api/events_full")

    assert response.status_code == 200
    assert response.get_json() == []


def test_admin_add_event_access_errors(logged_in_admin: FlaskClient, db_session: Session, user_factory: UserFactory):
    from data._roles import Roles
    from data.event import Event

    manager = user_factory("manager", "Manager", Roles.manager)
    event = Event.new(manager, "Manager event", date(2027, 1, 1))
    db_session.commit()

    added = logged_in_admin.post("/api/events/{}/add_access".format(event.id))
    duplicate = logged_in_admin.post("/api/events/{}/add_access".format(event.id))
    missing = logged_in_admin.post("/api/events/999999/add_access")

    assert added.status_code == 200
    assert duplicate.status_code == 400
    assert "already has access" in duplicate.get_json()["msg"]
    assert missing.status_code == 400
    assert "not found" in missing.get_json()["msg"]


def test_deleted_event_rejected_before_ticket_type_lookup(manager_context: ManagerContext):
    client, _, event, ticket_type = manager_context
    assert client.delete("/api/events/{}".format(event.id)).status_code == 200

    response = client.post(
        "/api/tickets",
        json={
            "requestId": str(uuid4()),
            "eventId": event.id,
            "typeId": ticket_type.id,
            "personName": "Person",
            "personLink": "",
            "promocode": "",
            "code": "DELETED-EVENT",
        },
    )

    assert response.status_code == 400
    assert response.get_json() == {"msg": "Event with 'eventId={}' not found".format(event.id)}


def test_ticket_create_error_responses(manager_context: ManagerContext, db_session: Session):
    client, manager, event, ticket_type = manager_context
    from bafser import Log

    from data.event import Event
    from data.request_operation import RequestOperation
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    other_event = Event(name="No access", date=date(2027, 1, 1), endDate=date(2027, 1, 1))
    db_session.add(other_event)
    db_session.commit()
    Event.get(other_event.id, for_update=True, db_sess=other_event.db_sess)
    other_type = single_day_variant(manager, other_event, "Other", None, datetime(2026, 9, 1, 12, 0))
    db_session.commit()
    payload = {
        "requestId": str(uuid4()),
        "eventId": event.id,
        "typeId": ticket_type.id,
        "personName": "Person",
        "personLink": "",
        "promocode": "",
        "code": "DUPLICATE-CODE",
    }

    assert client.post("/api/tickets", json=payload).status_code == 200
    before = [db_session.query(model).count() for model in (Ticket, Log, RequestOperation)]
    before_number = event.lastTicketNumber
    duplicate = client.post("/api/tickets", json={**payload, "requestId": str(uuid4())})
    db_session.expire_all()
    assert [db_session.query(model).count() for model in (Ticket, Log, RequestOperation)] == before
    assert event.lastTicketNumber == before_number
    missing_type = client.post("/api/tickets", json={**payload, "requestId": str(uuid4()), "typeId": 999999, "code": "MISSING-TYPE"})
    forbidden = client.post(
        "/api/tickets",
        json={
            "requestId": str(uuid4()),
            **payload,
            "eventId": other_event.id,
            "typeId": other_type.id,
            "code": "NO-ACCESS",
        },
    )

    assert duplicate.status_code == 400
    assert duplicate.get_json() == {"msg": "Ticket with 'code=DUPLICATE-CODE' already exist"}
    assert missing_type.status_code == 400
    assert "ticketType" in missing_type.get_json()["msg"]
    assert forbidden.status_code == 403


def test_ticket_update_and_delete_error_responses(manager_context: ManagerContext, db_session: Session):
    client, manager, event, ticket_type = manager_context
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket = Ticket.new(manager, ticket_type, event, "Person", "", "", "ERRORS")
    db_session.commit()
    other_event = Event.new(manager, "Other", date(2027, 2, 1))
    Event.get(other_event.id, for_update=True, db_sess=other_event.db_sess)
    other_type = single_day_variant(manager, other_event, "Other", None, datetime(2026, 9, 1, 12, 0))
    db_session.commit()
    payload = {
        "typeId": ticket_type.id,
        "personName": "Person",
        "personLink": "",
        "promocode": "",
    }

    bad_price = client.post("/api/tickets/{}".format(ticket.id), json={**payload, "price": "100"})
    missing_ticket = client.post("/api/tickets/999999", json=payload)
    missing_type = client.post("/api/tickets/{}".format(ticket.id), json={**payload, "typeId": 999999})
    wrong_type = client.post("/api/tickets/{}".format(ticket.id), json={**payload, "typeId": other_type.id})
    missing_delete = client.delete("/api/tickets/999999")

    assert bad_price.status_code == 400
    assert missing_ticket.status_code == 400
    assert missing_type.status_code == 400
    assert wrong_type.status_code == 400
    assert "another event" in wrong_type.get_json()["msg"]
    assert missing_delete.status_code == 400


def test_ticket_operations_reject_event_without_access(client: FlaskClient, login: Login, user_factory: UserFactory, db_session: Session, admin: User):
    from data._roles import Roles
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    manager = user_factory("manager", "Manager", Roles.manager)
    event = Event.new(admin, "Private", date(2027, 3, 1))
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket_type = single_day_variant(admin, event, "Private", None, datetime(2026, 9, 1, 12, 0))
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket = Ticket.new(admin, ticket_type, event, "Person", "", "", "PRIVATE")
    db_session.commit()
    login(manager.login)
    payload = {
        "typeId": ticket_type.id,
        "personName": "Person",
        "personLink": "",
        "promocode": "",
    }

    assert client.post("/api/tickets/{}".format(ticket.id), json=payload).status_code == 403
    assert client.delete("/api/tickets/{}".format(ticket.id)).status_code == 403


def test_check_ticket_wrong_event_response(manager_context: ManagerContext, db_session: Session):
    client, manager, event, ticket_type = manager_context
    from data.event import Event
    from data.ticket import Ticket

    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket = Ticket.new(manager, ticket_type, event, "Person", "", "", "WRONG-EVENT")
    db_session.commit()
    other = Event.new(manager, "Other", date(2027, 4, 1))
    db_session.commit()

    response = client.post("/api/check_ticket", json={"code": ticket.code, "eventId": other.id})

    assert response.status_code == 200
    assert response.get_json()["errorCode"] == "event"
    assert response.get_json()["event"]["id"] == event.id


@pytest.mark.parametrize(
    "item, message",
    [
        ({"action": "add", "price": 10}, "name"),
        ({"action": "add", "name": "Bad", "price": "10"}, "price"),
        ({"action": "update", "id": 999999, "name": "Bad", "price": None}, "not found"),
        ({"action": "delete", "id": 999999, "name": "Bad", "price": None}, "not found"),
    ],
)
def test_ticket_type_batch_validation_errors(manager_context: ManagerContext, item: dict[str, JsonValue], message: str):
    client, _, event, _ = manager_context

    response = client.post("/api/events/{}/ticket_types".format(event.id), json=single_day_catalog([item]))

    assert response.status_code == 400
    assert message in response.get_json()["msg"]


@pytest.mark.parametrize(
    "item, message",
    [
        ({"action": "add", "name": "", "price": 10}, "name"),
        ({"action": "add", "name": "x" * 65, "price": 10}, "name"),
        ({"action": "add", "name": "Bad", "price": -1}, "price"),
        ({"action": "add", "name": "Bad", "price": True}, "price"),
        ({"action": "update", "name": "Bad", "price": 10}, "id"),
    ],
)
def test_ticket_type_batch_rejects_invalid_values(manager_context: ManagerContext, item: dict[str, JsonValue], message: str):
    client, _, event, _ = manager_context

    response = client.post(f"/api/events/{event.id}/ticket_types", json=single_day_catalog([item]))

    assert response.status_code == 400
    assert message in response.get_json()["msg"]
    assert client.get(f"/api/events/{event.id}/ticket_types").get_json()


def test_ticket_type_delete_accepts_frontend_payload(manager_context: ManagerContext, db_session: Session):
    from data.ticket_type import TicketType

    client, _, event, original = manager_context
    response = client.post(
        f"/api/events/{event.id}/ticket_types",
        json={"categoryChanges": [], "typeChanges": [{"id": original.id, "action": "delete"}]},
    )

    assert response.status_code == 200
    assert len(response.get_json()["categories"]) == 1
    assert response.get_json()["categories"][0]["variants"][0]["deleted"]
    db_session.rollback()
    assert TicketType.get(original.id, includeDeleted=True, db_sess=db_session).deleted


@pytest.mark.parametrize("action", ["add", "update"])
def test_ticket_type_empty_name_is_rejected(manager_context: ManagerContext, action: str):
    client, _, event, original = manager_context
    response = client.post(
        f"/api/events/{event.id}/ticket_types",
        json=single_day_catalog([{"id": original.id, "name": "", "action": action}]),
    )

    assert response.status_code == 400
    assert "name" in response.get_json()["msg"]
    assert [item["name"] for item in client.get(f"/api/events/{event.id}/ticket_types").get_json()] == ["Standard"]


def test_ticket_type_batch_validation_keeps_existing_types(manager_context: ManagerContext):
    client, _, event, original = manager_context

    response = client.post(
        f"/api/events/{event.id}/ticket_types",
        json=single_day_catalog(
            [
                {"action": "update", "id": original.id, "name": "Changed", "price": 1},
                {"action": "add", "name": "", "price": 1},
            ]
        ),
    )

    assert response.status_code == 400
    listed = client.get(f"/api/events/{event.id}/ticket_types").get_json()
    assert [item["name"] for item in listed] == ["Standard"]


@pytest.mark.parametrize("action", ["update", "delete"])
def test_ticket_type_batch_cannot_modify_another_event(manager_context: ManagerContext, db_session: Session, action: str):
    client, manager, event, _ = manager_context
    from data.event import Event
    from data.ticket_type import TicketType

    other_event = Event.new(manager, "Other", date(2027, 5, 1))
    Event.get(other_event.id, for_update=True, db_sess=other_event.db_sess)
    other_type = single_day_variant(manager, other_event, "Protected", 500, datetime(2026, 9, 1, 12, 0))
    db_session.commit()

    response = client.post(
        "/api/events/{}/ticket_types".format(event.id),
        json=single_day_catalog(
            [
                {
                    "action": action,
                    "id": other_type.id,
                    "name": "Tampered",
                    "price": 1,
                }
            ]
        ),
    )

    db_session.expire_all()
    assert response.status_code == 400
    assert "another event" in response.get_json()["msg"]
    assert TicketType.get(other_type.id, db_sess=db_session).name == "Protected"


def test_ticket_type_detail_error_responses(manager_context: ManagerContext, client: FlaskClient, login: Login, user_factory: UserFactory, db_session: Session, admin: User):
    manager_client, _, event, _ = manager_context
    missing_get = manager_client.get("/api/ticket_types/999999")
    missing_change = manager_client.post("/api/ticket_types/999999", json={"pattern": {}, "img": None})

    assert missing_get.status_code == 400
    assert missing_change.status_code == 400


def test_ticket_type_detail_rejects_missing_access(client: FlaskClient, login: Login, user_factory: UserFactory, db_session: Session, admin: User):
    from data._roles import Roles
    from data.event import Event
    from data.ticket_type import TicketType

    user_factory("manager", "Manager", Roles.manager)
    event = Event.new(admin, "Private", date(2027, 6, 1))
    Event.get(event.id, for_update=True, db_sess=event.db_sess)
    ticket_type = single_day_variant(admin, event, "Private", None, datetime(2026, 9, 1, 12, 0))
    db_session.commit()
    login("manager")

    assert client.get("/api/ticket_types/{}".format(ticket_type.id)).status_code == 403
    assert (
        client.post(
            "/api/ticket_types/{}".format(ticket_type.id),
            json={"pattern": {}, "img": None},
        ).status_code
        == 403
    )


def test_ticket_type_design_rejects_invalid_image(manager_context: ManagerContext):
    client, _, _, ticket_type = manager_context

    response = client.post(
        "/api/ticket_types/{}".format(ticket_type.id),
        json={
            "pattern": {},
            "img": {"name": "broken", "data": "invalid", "accessEventId": None},
        },
    )

    assert response.status_code == 400
    assert "base64" in response.get_json()["msg"]


@pytest.mark.parametrize(
    "path,payload",
    [
        ("/api/events", {"name": "Missing date"}),
        ("/api/tickets", {"typeId": 1}),
        ("/api/tickets/999999", {"personName": "Missing type"}),
        ("/api/staff", {"name": "Missing login"}),
    ],
)
def test_required_json_fields_return_client_error(manager_context: ManagerContext, path: str, payload: dict[str, JsonValue]):
    client, _, _, _ = manager_context

    response = client.post(path, json=payload)

    assert response.status_code == 400
    assert set(response.get_json()) == {"msg"}


def test_ticket_type_design_requires_pattern(manager_context: ManagerContext):
    client, _, _, ticket_type = manager_context

    response = client.post("/api/ticket_types/{}".format(ticket_type.id), json={"img": None})

    assert response.status_code == 400
    assert "pattern" in response.get_json()["msg"]
