from __future__ import annotations

from typing import TYPE_CHECKING

import io
from pathlib import Path

import pytest

if TYPE_CHECKING:
    from fixture_types import UserFactory
    from flask import Flask
    from flask.testing import FlaskClient
    from sqlalchemy.orm import Session


@pytest.fixture
def csrf_client(app: Flask, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setitem(app.config, "JWT_COOKIE_CSRF_PROTECT", True)
    monkeypatch.setitem(app.config, "JWT_COOKIE_SAMESITE", "Lax")
    monkeypatch.setitem(app.config, "JWT_COOKIE_SECURE", True)
    client = app.test_client()
    response = client.post("/api/auth", json={"login": "admin", "password": "admin"}, base_url="https://localhost")
    assert response.status_code == 200
    cookie = client.get_cookie("csrf_access_token")
    assert cookie is not None
    return client, cookie.value


def test_login_sets_secure_cookie_and_readable_csrf_cookie(csrf_client: tuple[FlaskClient, str]):
    client, _ = csrf_client
    access = client.get_cookie("access_token_cookie")
    csrf = client.get_cookie("csrf_access_token")
    assert access is not None and access.secure and access.http_only and access.same_site == "Lax"
    assert csrf is not None and csrf.secure and not csrf.http_only and csrf.same_site == "Lax"
    assert client.get("/api/user", base_url="https://localhost").status_code == 200


@pytest.mark.parametrize("token", [None, "wrong-token"])
def test_cookie_write_rejects_missing_or_incorrect_csrf_token(csrf_client: tuple[FlaskClient, str], token: str | None):
    client, _ = csrf_client
    before = client.get("/api/user", base_url="https://localhost").get_json()

    response = client.post(
        "/api/user/change_name", json={"name": "Rejected"},
        headers={"X-CSRF-TOKEN": token} if token is not None else {}, base_url="https://localhost",
    )

    assert response.status_code == 401
    assert client.get("/api/user", base_url="https://localhost").get_json() == before


def test_cookie_write_accepts_matching_csrf_token(csrf_client: tuple[FlaskClient, str]):
    client, token = csrf_client
    response = client.post(
        "/api/user/change_name", json={"name": "Renamed"}, headers={"X-CSRF-TOKEN": token}, base_url="https://localhost",
    )
    assert response.status_code == 200
    assert client.get("/api/user", base_url="https://localhost").get_json()["name"] == "Renamed"


def test_cross_site_multipart_upload_is_rejected_without_side_effects(
    csrf_client: tuple[FlaskClient, str], app: Flask, db_session: Session
):
    from bafser import Log

    from data.font import Font

    client, _ = csrf_client
    directory = Path(app.config["FONTS_FOLDER"])
    files = {path.name for path in directory.iterdir()}
    log_count = db_session.query(Log).count()

    response = client.post(
        "/api/fonts", base_url="https://localhost", content_type="multipart/form-data",
        data={"name": "Rejected font", "type": "woff2", "font": (io.BytesIO(b"wOF2 rejected"), "font.woff2")},
        headers={"Origin": "https://untrusted.example", "Referer": "https://untrusted.example/attack"},
    )

    assert response.status_code == 401
    db_session.rollback()
    assert db_session.query(Font).count() == 0
    assert db_session.query(Log).count() == log_count
    assert {path.name for path in directory.iterdir()} == files


def test_multipart_upload_accepts_matching_csrf_token(csrf_client: tuple[FlaskClient, str], app: Flask, db_session: Session):
    from data.font import Font

    client, token = csrf_client
    content = b"wOF2 accepted font"
    response = client.post(
        "/api/fonts", base_url="https://localhost", content_type="multipart/form-data",
        data={"name": "Accepted font", "type": "woff2", "font": (io.BytesIO(content), "font.woff2")},
        headers={"X-CSRF-TOKEN": token},
    )
    assert response.status_code == 200
    db_session.rollback()
    font = db_session.query(Font).one()
    assert (Path(app.config["FONTS_FOLDER"]) / f"{font.id}.woff2").read_bytes() == content


def test_cookie_delete_requires_csrf_token(csrf_client: tuple[FlaskClient, str], user_factory: UserFactory, db_session: Session):
    from data._roles import Roles
    from data.user import User

    client, token = csrf_client
    manager = user_factory("manager", "Manager", Roles.manager)
    manager_id = manager.id
    url = f"/api/managers/{manager_id}"

    assert client.delete(url, base_url="https://localhost").status_code == 401
    db_session.rollback()
    assert User.get(manager_id, db_sess=db_session) is not None
    assert client.delete(url, base_url="https://localhost", headers={"X-CSRF-TOKEN": token}).status_code == 200
