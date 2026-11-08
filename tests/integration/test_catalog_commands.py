from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from data.event import EventData
    from fixture_types import CatalogContext, JsonValue
    from flask.testing import FlaskClient


@pytest.fixture
def catalog_context(logged_in_admin: FlaskClient):
    client = logged_in_admin
    event = client.post("/api/events", json={"name": "Catalog commands", "date": "2026-11-01", "twoDays": True}).get_json()
    url = f"/api/events/{event['id']}/ticket_types"
    response = client.post(url, json={
        "categoryChanges": [{"action": "add", "clientId": "initial", "name": "Initial"}],
        "typeChanges": [{"action": "add", "categoryRef": {"clientId": "initial"},
                         "dayOffsets": [0], "name": "First", "price": 0, "quantity": 10}],
    })
    assert response.status_code == 200, response.get_json()
    return client, event, response.get_json()


def read_catalog(client: FlaskClient, event: EventData):
    return client.get(f"/api/events/{event['id']}/ticket_categories").get_json()


@pytest.mark.parametrize("legacy", [[], [{"action": "add", "name": "Old client", "price": 10}]])
@pytest.mark.parametrize("two_days", [False, True])
def test_legacy_catalog_arrays_are_rejected_without_writes(catalog_context: CatalogContext, legacy: list[dict[str, JsonValue]], two_days: bool):
    client, event, before = catalog_context
    if not two_days:
        changed = client.post(f"/api/events/{event['id']}", json={"name": event["name"], "date": event["date"], "twoDays": False})
        assert changed.status_code == 200
    response = client.post(f"/api/events/{event['id']}/ticket_types", json=legacy)
    assert response.status_code == 400
    assert read_catalog(client, event) == before


@pytest.mark.parametrize("reference", [
    None, [], 1, "initial", {}, {"clientId": []}, {"clientId": {}}, {"clientId": 1},
    {"clientId": None}, {"clientId": ""}, {"id": True}, {"id": 0}, {"id": -1},
    {"id": 2_147_483_648}, {"id": 1, "clientId": "initial"}, {"unknown": "initial"},
])
def test_malformed_category_refs_are_400_and_do_not_partially_save(catalog_context: CatalogContext, reference: JsonValue):
    client, event, before = catalog_context
    response = client.post(f"/api/events/{event['id']}/ticket_types", json={
        "categoryChanges": [{"action": "add", "clientId": "pending", "name": "Must not persist"}],
        "typeChanges": [{"action": "add", "categoryRef": reference, "dayOffsets": [1], "name": "Invalid reference"}],
    })
    assert response.status_code == 400, response.get_json()
    assert read_catalog(client, event) == before


@pytest.mark.parametrize("changes", [
    {}, {"categoryChanges": []}, {"typeChanges": []},
    {"categoryChanges": {}, "typeChanges": []},
    {"categoryChanges": [], "typeChanges": {}},
    {"categoryChanges": [], "typeChanges": [], "unexpected": True},
    {"categoryChanges": [{"action": "add", "name": "Missing client"}], "typeChanges": []},
    {"categoryChanges": [{"action": "add", "name": "Bad client", "clientId": []}], "typeChanges": []},
    {"categoryChanges": [{"action": "update", "name": "Missing id"}], "typeChanges": []},
    {"categoryChanges": [{"action": "delete", "id": True}], "typeChanges": []},
    {"categoryChanges": [], "typeChanges": [{"action": "invalid"}]},
    {"categoryChanges": [], "typeChanges": [{"action": None}]},
    {"categoryChanges": [], "typeChanges": [{"action": []}]},
    {"categoryChanges": [], "typeChanges": [{"action": {}}]},
    {"categoryChanges": [], "typeChanges": [{"action": 1}]},
    {"categoryChanges": [], "typeChanges": [{"action": True}]},
    {"categoryChanges": [None], "typeChanges": []},
    {"categoryChanges": [], "typeChanges": [1]},
    {"categoryChanges": [], "typeChanges": [{"action": "update", "id": 1, "name": None}]},
    {"categoryChanges": [], "typeChanges": [{"action": "update", "id": 1, "quantity": True}]},
    {"categoryChanges": [], "typeChanges": [{"action": "delete", "id": 1, "name": "Unexpected"}]},
])
def test_catalog_command_shape_is_validated_before_execution(catalog_context: CatalogContext, changes: dict[str, JsonValue]):
    client, event, before = catalog_context
    response = client.post(f"/api/events/{event['id']}/ticket_types", json=changes)
    assert response.status_code == 400, response.get_json()
    assert read_catalog(client, event) == before


def test_unknown_client_ref_rolls_back_prior_category_commands(catalog_context: CatalogContext):
    client, event, before = catalog_context
    response = client.post(f"/api/events/{event['id']}/ticket_types", json={
        "categoryChanges": [{"action": "add", "clientId": "pending", "name": "Must roll back"}],
        "typeChanges": [{"action": "add", "categoryRef": {"clientId": "unknown"}, "dayOffsets": [1], "name": "Unknown client"}],
    })
    assert response.status_code == 400
    assert read_catalog(client, event) == before


def test_duplicate_client_ids_roll_back_the_complete_catalog(catalog_context: CatalogContext):
    client, event, before = catalog_context
    response = client.post(f"/api/events/{event['id']}/ticket_types", json={
        "categoryChanges": [{"action": "add", "clientId": "same", "name": name} for name in ("First", "Second")],
        "typeChanges": [],
    })
    assert response.status_code == 400
    assert read_catalog(client, event) == before


@pytest.mark.parametrize("field, value", [("dayOffsets", [1]), ("categoryRef", {"id": 1}), ("categoryId", 1)])
def test_existing_variant_days_and_parent_cannot_be_changed(catalog_context: CatalogContext, field: str, value: list[int] | dict[str, int] | int):
    client, event, before = catalog_context
    category = before["categories"][0]
    variant = category["variants"][0]
    response = client.post(f"/api/events/{event['id']}/ticket_types", json={
        "categoryChanges": [{"action": "update", "id": category["id"], "name": "Must not change"}],
        "typeChanges": [{"action": "update", "id": variant["id"], field: value}],
    })
    assert response.status_code == 400
    assert "typeChanges" in response.get_json()["msg"]
    assert read_catalog(client, event) == before


def test_foreign_category_id_cannot_be_used(catalog_context: CatalogContext):
    client, event, before = catalog_context
    other = client.post("/api/events", json={"name": "Other", "date": "2026-11-01"}).get_json()
    response = client.post(f"/api/events/{other['id']}/ticket_types", json={
        "categoryChanges": [{"action": "add", "clientId": "other", "name": "Other"}], "typeChanges": [],
    })
    assert response.status_code == 200
    foreign_id = response.get_json()["categories"][0]["id"]
    response = client.post(f"/api/events/{event['id']}/ticket_types", json={
        "categoryChanges": [],
        "typeChanges": [{"action": "add", "categoryRef": {"id": foreign_id}, "dayOffsets": [1], "name": "Foreign"}],
    })
    assert response.status_code == 400
    assert read_catalog(client, event) == before


def test_partial_variant_updates_keep_quantity_price_and_zero(catalog_context: CatalogContext):
    client, event, before = catalog_context
    variant_id = before["categories"][0]["variants"][0]["id"]
    url = f"/api/events/{event['id']}/ticket_types"

    def update(**values: JsonValue):
        response = client.post(url, json={"categoryChanges": [], "typeChanges": [{"action": "update", "id": variant_id, **values}]})
        assert response.status_code == 200, response.get_json()
        return response.get_json()["categories"][0]["variants"][0]

    renamed = update(name="Renamed")
    assert (renamed["name"], renamed["price"], renamed["quantity"]) == ("Renamed", 0, 10)
    assert update(price=None)["quantity"] == 10
    zero = update(quantity=0)
    assert zero["quantity"] == 0 and zero["price"] is None
    assert update(quantity=None)["quantity"] is None
