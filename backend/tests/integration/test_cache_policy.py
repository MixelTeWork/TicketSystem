from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from flask.testing import FlaskClient


@pytest.mark.parametrize("path,method,status", [
    ("/api/user", "GET", 401),
    ("/api/help", "GET", 401),
    ("/api/missing", "GET", 404),
    ("/api", "GET", 200),
    ("/api/user", "PATCH", 405),
])
def test_api_responses_and_errors_default_to_private_no_store(client: FlaskClient, path: str, method: str, status: int):
    response = client.open(path, method=method)
    assert response.status_code == status
    assert response.cache_control.private
    assert response.cache_control.no_store
    assert not response.cache_control.public


@pytest.mark.parametrize("path", ["/api/user", "/api/events", "/api/fonts", "/api/debug/log_len", "/api/help", "/api/help/releases"])
def test_authenticated_api_defaults_to_private_no_store(logged_in_admin: FlaskClient, path: str):
    response = logged_in_admin.get(path)
    assert response.status_code == 200
    assert response.cache_control.private
    assert response.cache_control.no_store
    assert not response.cache_control.public
