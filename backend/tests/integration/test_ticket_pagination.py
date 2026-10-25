from datetime import datetime
import json

import pytest


@pytest.fixture
def ticket_page_context(db_session, user_factory, login):
    from data._roles import Roles
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    manager = user_factory("manager", "Manager", Roles.manager)
    event = Event.new(manager, "Paged event", datetime(2026, 10, 24, 18, 0))
    standard, _ = TicketType.add(manager, event, "Standard", 100, datetime(2026, 9, 1))
    old_type, _ = TicketType.add(manager, event, "Old", 0, datetime(2026, 9, 1))
    old_type.deleted = True
    db_session.commit()
    rows = []
    for index in range(31):
        ticket = Ticket(
            createdDate=datetime(2026, 9, 10 + index % 3, 20, 59, 59), createdById=manager.id,
            eventId=event.id, typeId=standard.id if index % 2 == 0 else old_type.id,
            code=f"CUSTOM-{index:04d}", personName="АнНа Иванова" if index % 2 == 0 else "Борис",
            promocode="VIP%_" if index % 3 == 0 else "", authOnPltf=index == 0,
        )
        db_session.add(ticket)
        rows.append(ticket)
    deleted = Ticket(createdDate=datetime(2026, 9, 10), createdById=manager.id,
                     eventId=event.id, typeId=standard.id, code="DELETED")
    deleted.deleted = True
    db_session.add(deleted)
    db_session.commit()
    return login("manager"), manager, event, standard, old_type, [row.id for row in rows]


def test_pages_are_bounded_ordered_and_disjoint(ticket_page_context):
    client, _, event, _, _, ids = ticket_page_context
    url = f"/api/events/{event.id}/tickets/page"
    first = client.post(url, json={}).get_json()
    second = client.post(url, json={"page": 2}).get_json()
    assert first["count"] == first["total"] == 31
    assert first["pages"] == 2
    assert [row["id"] for row in first["items"]] == list(reversed(ids))[0:25]
    assert [row["id"] for row in second["items"]] == list(reversed(ids))[25:]
    assert first["hasAuth"] is True
    assert any(row["type"].startswith("<Удалён>") for row in first["items"])
    assert first["promocodes"] == ["VIP%_"]
    assert client.post(url, json={"page": 999}).get_json()["page"] == 2
    assert len(client.post(url, json={"pageSize": "all"}).get_json()["items"]) == 31
    assert len(client.get(f"/api/events/{event.id}/tickets").get_json()) == 31


def test_search_is_case_insensitive_for_cyrillic_and_code(ticket_page_context):
    client, _, event, _, _, _ = ticket_page_context
    url = f"/api/events/{event.id}/tickets/page"
    assert client.post(url, json={"search": "анна"}).get_json()["count"] == 16
    assert client.post(url, json={"search": "custom-0030"}).get_json()["count"] == 1
    # SQL wildcard characters are literal input, including in a promocode.
    assert client.post(url, json={"search": "%_"}).get_json()["count"] == 11
    assert client.post(url, json={"search": "CUSTOM-9999"}).get_json()["count"] == 0


def test_filters_combine_and_include_the_whole_end_date(ticket_page_context):
    client, _, event, standard, _, ids = ticket_page_context
    result = client.post(f"/api/events/{event.id}/tickets/page", json={
        "search": "анна", "typeId": standard.id, "promocode": "vip%_",
        "dateFrom": "2026-09-10", "dateTo": "2026-09-10", "auth": "no",
    }).get_json()
    assert [row["id"] for row in result["items"]] == [ids[30], ids[24], ids[18], ids[12], ids[6]]
    assert result["total"] == 31 and result["count"] == 5
    assert result["hasAuth"] is True  # event-wide column stays stable on all pages/filters
    no_promo = client.post(f"/api/events/{event.id}/tickets/page", json={"noPromocode": True}).get_json()
    assert no_promo["count"] == 20


def test_maximum_end_date_does_not_overflow(ticket_page_context):
    client, _, event, _, _, _ = ticket_page_context
    response = client.post(f"/api/events/{event.id}/tickets/page", json={"dateTo": "9999-12-31"})
    assert response.status_code == 200
    assert response.get_json()["count"] == 31


def test_edit_preserves_original_deleted_type_but_cannot_assign_it(ticket_page_context):
    client, _, _, standard, old_type, ids = ticket_page_context
    details = {"typeId": old_type.id, "personName": "Updated", "personLink": "", "promocode": "", "price": 0}
    updated = client.post(f"/api/tickets/{ids[1]}", json=details)
    assert updated.status_code == 200
    assert updated.get_json()["typeId"] == old_type.id
    assert updated.get_json()["code"] == "CUSTOM-0001"
    assert client.post(f"/api/tickets/{ids[0]}", json=details).status_code == 400
    details["typeId"] = standard.id
    assert client.post(f"/api/tickets/{ids[1]}", json=details).status_code == 200


@pytest.mark.parametrize("params", [
    {"page": "bad"}, {"page": 0}, {"pageSize": 0}, {"pageSize": 101}, {"pageSize": "bad"},
    {"typeId": -1}, {"typeId": 2_147_483_648}, {"typeId": "9" * 100}, {"auth": "bad"}, {"dateFrom": "2026-02-31"},
    {"dateFrom": "2026-09-11", "dateTo": "2026-09-10"}, {"search": "x" * 257},
    {"dateFrom": "0001-01-01"},
    {"page": True}, {"page": "1"}, {"pageSize": True}, {"pageSize": "25"},
    {"pageSize": None}, {"typeId": True}, {"typeId": "1"}, {"noPromocode": "true"},
    {"dateTo": "bad"}, {"auth": None}, {"promocode": "x" * 65},
])
def test_invalid_pagination_and_filters_return_400(ticket_page_context, params):
    client, _, event, _, _, _ = ticket_page_context
    response = client.post(f"/api/events/{event.id}/tickets/page", json=params)
    assert response.status_code == 400


def test_page_does_not_expose_unassigned_events(ticket_page_context, login, user_factory):
    from data._roles import Roles

    client, _, event, _, _, _ = ticket_page_context
    user_factory("other", "Other", Roles.manager)
    login("other")
    assert client.post(f"/api/events/{event.id}/tickets/page").status_code == 403


def test_usher_cannot_read_ticket_pages(ticket_page_context, login, user_factory):
    from data._roles import Roles

    client, manager, event, _, _, _ = ticket_page_context
    usher = user_factory("usher", "Usher", Roles.usher)
    usher.add_access(event.id, manager)
    login("usher")
    assert client.post(f"/api/events/{event.id}/tickets/page").status_code == 403


@pytest.mark.parametrize("body", [None, [], "filters"])
def test_page_requires_a_json_object(ticket_page_context, body):
    client, _, event, _, _, _ = ticket_page_context
    response = client.post(f"/api/events/{event.id}/tickets/page", data=json.dumps(body), content_type="application/json")
    assert response.status_code == 400


def test_page_filters_come_from_body_not_query_string(ticket_page_context):
    client, _, event, _, _, _ = ticket_page_context
    url = f"/api/events/{event.id}/tickets/page"
    response = client.post(url, query_string={"search": "missing"}, json={"search": "custom-0030"})
    assert response.status_code == 200
    assert response.get_json()["count"] == 1
    # The frontend GET catch-all returns the standard API 404 for the removed route.
    assert client.get(url).status_code == 404
