from __future__ import annotations

from typing import TYPE_CHECKING

from datetime import date
import base64
from io import BytesIO
from pathlib import Path

import pytest
from sqlalchemy import func, select

if TYPE_CHECKING:
    from data.user import User
    from fixture_types import Login, UserFactory
    from flask import Flask
    from flask.testing import FlaskClient
    from sqlalchemy.orm import Session
    from typing import BinaryIO


PNG_BYTES = b"\x89PNG\r\n\x1a\ncontract-image"


def test_fonts_page_and_bundled_font_assets_do_not_conflict(client: FlaskClient, app: Flask):
    frontend = Path(app.config["TEST_STORAGE_ROOT"]).parent / "frontend"
    font_assets = frontend / "fonts"
    font_assets.mkdir(parents=True, exist_ok=True)
    index = frontend / "index.html"
    stylesheet = font_assets / "test-fonts.css"
    font_file = font_assets / "test-font.woff2"
    index.write_text("<!doctype html><title>TicketSystem test entry</title>", encoding="utf-8")
    stylesheet.write_text("@font-face {}", encoding="utf-8")
    font_file.write_bytes(b"bundled font")
    try:
        for path in ("/fonts", "/fonts/"):
            with client.get(path) as page:
                assert page.status_code == 200
                assert page.content_type.startswith("text/html")
                assert b"TicketSystem test entry" in page.data
                assert "immutable" not in page.headers["Cache-Control"]
        for path, content in (
            ("/fonts/test-fonts.css", b"@font-face {}"),
            ("/fonts/test-font.woff2", b"bundled font"),
        ):
            with client.get(path) as asset:
                assert asset.status_code == 200
                assert asset.data == content
                assert "immutable" in asset.headers["Cache-Control"]
        assert client.get("/fonts/missing.ttf").status_code == 404
        assert client.get("/api/fonts").status_code == 401
    finally:
        index.unlink()
        stylesheet.unlink()
        font_file.unlink()


def test_image_upload_and_download(logged_in_admin: FlaskClient):
    encoded = base64.b64encode(PNG_BYTES).decode("ascii")

    uploaded = logged_in_admin.post(
        "/api/img",
        json={
            "img": {
                "name": "contract",
                "data": "data:image/png;base64," + encoded,
                "accessEventId": None,
            }
        },
    )
    image_id = uploaded.get_json()["id"]
    downloaded = logged_in_admin.get("/api/img/{}".format(image_id))

    assert uploaded.status_code == 200
    assert downloaded.status_code == 200
    assert downloaded.data == PNG_BYTES
    assert downloaded.content_type == "image/png"
    assert downloaded.cache_control.private
    assert downloaded.cache_control.no_store
    assert not downloaded.cache_control.public


def test_image_rejects_invalid_encoding(logged_in_admin: FlaskClient):
    response = logged_in_admin.post(
        "/api/img",
        json={
            "img": {
                "name": "broken",
                "data": "not-base64",
                "accessEventId": None,
            }
        },
    )

    assert response.status_code == 400
    assert response.get_json() == {"msg": "img data is not base64", "code": "invalid_image"}


def test_image_requires_payload(logged_in_admin: FlaskClient):
    response = logged_in_admin.post("/api/img", json={})

    assert response.status_code == 400
    assert "img" in response.get_json()["msg"]


def test_font_upload_list_and_download(logged_in_admin: FlaskClient):
    font_data = b"test-font-binary"

    uploaded = logged_in_admin.post(
        "/api/fonts",
        data={
            "name": "Contract font",
            "type": "ttf",
            "font": (BytesIO(font_data), "contract.ttf"),
        },
        content_type="multipart/form-data",
    )
    font_id = uploaded.get_json()["id"]
    listed = logged_in_admin.get("/api/fonts")
    downloaded = logged_in_admin.get("/api/fonts/{}".format(font_id))

    assert uploaded.status_code == 200
    assert uploaded.get_json()["type"] == "ttf"
    assert listed.get_json() == [uploaded.get_json()]
    assert downloaded.status_code == 200
    assert downloaded.data == font_data
    assert downloaded.content_type == "font/ttf"
    assert downloaded.cache_control.private
    assert downloaded.cache_control.no_store
    assert not downloaded.cache_control.public


def test_failed_font_save_rolls_back_record_and_removes_partial_file(
    app: Flask, db_session: Session, admin: User, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
):
    from bafser import Log
    from data.font import Font

    monkeypatch.setitem(app.config, "FONTS_FOLDER", str(tmp_path))

    class BrokenFile:
        def save(self, target: BinaryIO):
            target.write(b"partial")
            raise OSError("disk write failed")

    with app.app_context(), pytest.raises(OSError, match="disk write failed"):
        Font.new(admin, "Broken font", "ttf", BrokenFile())

    assert db_session.scalar(select(func.count()).select_from(Font)) == 0
    assert db_session.scalar(select(func.count()).select_from(Log)) == 0
    assert list(tmp_path.iterdir()) == []


def test_font_validation_and_unique_name(logged_in_admin: FlaskClient):
    first = logged_in_admin.post(
        "/api/fonts",
        data={
            "name": "Duplicate",
            "type": "ttf",
            "font": (BytesIO(b"one"), "one.ttf"),
        },
        content_type="multipart/form-data",
    )
    duplicate = logged_in_admin.post(
        "/api/fonts",
        data={
            "name": "Duplicate",
            "type": "ttf",
            "font": (BytesIO(b"two"), "two.ttf"),
        },
        content_type="multipart/form-data",
    )
    invalid = logged_in_admin.post(
        "/api/fonts",
        data={
            "name": "Invalid",
            "type": "exe",
            "font": (BytesIO(b"bad"), "bad.exe"),
        },
        content_type="multipart/form-data",
    )

    assert first.status_code == 200
    assert duplicate.status_code == 400
    assert invalid.status_code == 400
    assert duplicate.get_json()["code"] == "font_exists"
    assert "is not in" in invalid.get_json()["msg"]


def test_debug_log_contract_and_negative_page(logged_in_admin: FlaskClient):
    log_items = logged_in_admin.get("/api/debug/log")
    length = logged_in_admin.get("/api/debug/log_len")
    negative_page = logged_in_admin.get("/api/debug/log?p=-1")

    assert log_items.status_code == 200
    assert isinstance(log_items.get_json(), list)
    assert length.status_code == 200
    assert set(length.get_json()) == {"len"}
    assert negative_page.get_json() == []


def test_missing_font_and_image_return_not_found(logged_in_admin: FlaskClient):
    assert logged_in_admin.get("/api/fonts/999999").status_code == 404
    assert logged_in_admin.get("/api/img/999999").status_code == 404


def test_font_rejects_missing_fields_and_file(logged_in_admin: FlaskClient):
    missing_name = logged_in_admin.post(
        "/api/fonts",
        data={"type": "ttf", "font": (BytesIO(b"font"), "font.ttf")},
        content_type="multipart/form-data",
    )
    missing_file = logged_in_admin.post(
        "/api/fonts",
        data={"name": "No file", "type": "ttf"},
        content_type="multipart/form-data",
    )

    assert missing_name.status_code == 400
    assert "name" in missing_name.get_json()["msg"]
    assert missing_file.status_code == 400
    assert missing_file.get_json() == {"msg": "file font is None"}


def test_event_image_is_forbidden_without_access(
    logged_in_admin: FlaskClient, login: Login, user_factory: UserFactory, db_session: Session
):
    from data._roles import Roles
    from data.event import Event

    event = Event.new(
        user_factory("owner", "Owner", Roles.owner),
        "Private image event",
        date(2027, 1, 1),
    )
    db_session.commit()
    encoded = base64.b64encode(PNG_BYTES).decode("ascii")
    uploaded = logged_in_admin.post(
        "/api/img",
        json={
            "img": {
                "name": "private",
                "data": "data:image/png;base64," + encoded,
                "accessEventId": event.id,
            }
        },
    )
    image_id = uploaded.get_json()["id"]
    user_factory("manager", "Manager", Roles.manager)
    login("manager")

    response = logged_in_admin.get("/api/img/{}".format(image_id))

    assert response.status_code == 403
    assert response.cache_control.private
    assert response.cache_control.no_store


def test_all_debug_log_files_are_readable(logged_in_admin: FlaskClient):
    for path in (
        "/api/debug/log_info",
        "/api/debug/log_requests",
        "/api/debug/log_errors",
        "/api/debug/log_frontend",
    ):
        response = logged_in_admin.get(path)
        assert response.status_code == 200
        assert response.mimetype == "text/plain"
        assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_public_frontend_error_html_is_inert_in_raw_logs(
    app: Flask, logged_in_admin: FlaskClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(app.extensions["bafser_config"], "DEV_MODE", False)
    marker = "<script>window.__log_security_canary=1</script>"
    anonymous = app.test_client()
    assert anonymous.post("/api/frontend_error", json={"message": marker}).status_code == 200

    for path in ("/api/debug/log_frontend", "/api/debug/log_requests"):
        response = logged_in_admin.get(path)
        assert response.status_code == 200
        assert response.content_type == "text/plain; charset=utf-8"
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert marker in response.get_data(as_text=True)


@pytest.mark.parametrize("payload,expected", [
    (
        {
            "msg": "frontend-window-error",
            "url": "/static/app.js",
            "line": 4,
            "col": 2,
            "error": {"message": "nested-error-message", "stack": "frontend-stack", "password": "nested-secret-canary"},
            "buyerEmail": "private-canary@example.test",
            "accessToken": "root-secret-canary",
        },
        ("frontend-window-error", "/static/app.js", "nested-error-message", "frontend-stack"),
    ),
    (
        {"message": "frontend-rejection-message", "stack": "frontend-rejection-stack", "extra": "unapproved-field-canary"},
        ("frontend-rejection-message", "frontend-rejection-stack"),
    ),
])
def test_frontend_error_production_logs_approved_fields(
    client: FlaskClient, monkeypatch: pytest.MonkeyPatch, payload: dict[str, object], expected: tuple[str, ...]
):
    import bafser_config
    from bafser import get_app_config

    monkeypatch.setattr(get_app_config(), "DEV_MODE", False)

    response = client.post("/api/frontend_error?accessToken=query-secret-canary", json=payload)

    assert response.status_code == 200
    assert response.get_data(as_text=True) == "ok"
    logged = Path(bafser_config.log_frontend_path).read_text(encoding="utf-8")
    request_log = Path(bafser_config.log_requests_path).read_text(encoding="utf-8")
    for value in expected:
        assert value in logged
    for value in (
        "nested-secret-canary", "private-canary@example.test", "root-secret-canary",
        "query-secret-canary", "unapproved-field-canary",
    ):
        assert value not in logged
        assert value not in request_log


def test_frontend_error_production_bounds_long_diagnostics(client: FlaskClient, monkeypatch: pytest.MonkeyPatch):
    import bafser_config
    from bafser import get_app_config

    monkeypatch.setattr(get_app_config(), "DEV_MODE", False)
    response = client.post("/api/frontend_error", json={"message": "bounded-frontend-message-" + "x" * 12000 + "-unlogged-end-canary"})

    assert response.status_code == 200
    logged = Path(bafser_config.log_frontend_path).read_text(encoding="utf-8")
    assert "bounded-frontend-message-" in logged
    assert "[truncated]" in logged
    assert "-unlogged-end-canary" not in logged


def test_frontend_error_rejects_oversized_payload_before_logging(client: FlaskClient):
    import bafser_config

    response = client.post("/api/frontend_error", json={"message": "oversized-frontend-canary" + "x" * (32 * 1024)})

    assert response.status_code == 413
    assert "oversized-frontend-canary" not in Path(bafser_config.log_frontend_path).read_text(encoding="utf-8")


def test_dashboard_uses_existing_debug_permission(client: FlaskClient, login: Login, user_factory: UserFactory):
    from data._roles import Roles

    assert client.get("/api/dashboard").status_code == 401
    user_factory("dashboard-clerk", "Clerk", Roles.clerk)
    login("dashboard-clerk")
    assert client.get("/api/dashboard").status_code == 403
    login("admin", "admin")

    response = client.get("/api/dashboard")

    assert response.status_code == 200
    assert response.content_type.startswith("text/html")
    assert "Request dashboard" in response.get_data(as_text=True)
    assert response.cache_control.private
    assert response.cache_control.no_store


def test_debug_log_includes_system_audit_author(logged_in_admin: FlaskClient, db_session: Session, admin: User):
    from bafser import Log

    system_log = Log.updated(admin, actor=None, changes=[("name", "Before", "After")], db_sess=db_session)

    response = logged_in_admin.get("/api/debug/log")

    assert response.status_code == 200
    item = next(entry for entry in response.get_json() if entry["id"] == system_log.id)
    assert item["userId"] is None
    assert item["userName"] == "System"


def test_log_tail_preserves_line_order_unicode_and_unterminated_line(tmp_path: Path):
    from blueprints.debug import last_n_lines

    path = tmp_path / "sample.log"
    path.write_bytes("first\r\nвторая\r\nтретья".encode("utf-8"))

    assert last_n_lines(str(path), 2) == "вторая\nтретья"
    assert last_n_lines(str(path), 20) == "first\nвторая\nтретья"
    assert last_n_lines(str(path), 0) == ""


def test_log_tail_reads_only_bounded_suffix(monkeypatch: pytest.MonkeyPatch):
    from blueprints import debug

    content = b"prefix\n" * 150000 + b"last-1\nlast-2\n"
    total_read = 0

    class LimitedReader(BytesIO):
        def read(self, size: int | None = -1) -> bytes:
            nonlocal total_read
            assert size is not None and 0 <= size <= 256 * 1024 + 1, "The debug viewer must not read an unbounded log."
            data = super().read(size)
            total_read += len(data)
            return data

    monkeypatch.setattr(debug, "open", lambda *args, **kwargs: LimitedReader(content), raising=False)

    result = debug.last_n_lines("ignored.log", 2)

    assert total_read <= 256 * 1024 + 1
    assert result.startswith("[truncated:")
    assert result.endswith("last-1\nlast-2\n")


def test_log_tail_keeps_complete_line_at_byte_boundary(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    from blueprints import debug

    path = tmp_path / "sample.log"
    path.write_bytes(b"prefix\nsecond\nlast\n")
    monkeypatch.setattr(debug, "LOG_TAIL_MAX_BYTES", len(b"second\nlast\n"))

    result = debug.last_n_lines(str(path), 3)

    assert result.endswith("second\nlast\n")


def test_log_tail_handles_empty_missing_and_single_overlong_line(tmp_path: Path):
    from blueprints.debug import LOG_TAIL_MAX_BYTES, last_n_lines

    path = tmp_path / "sample.log"
    assert last_n_lines(str(path), 3) == ""
    path.write_bytes(b"")
    assert last_n_lines(str(path), 3) == ""
    path.write_bytes(b"x" * (LOG_TAIL_MAX_BYTES + 10) + b"-end")
    result = last_n_lines(str(path), 3)
    assert result.startswith("[truncated:")
    assert result.endswith("-end")
    assert len(result) <= LOG_TAIL_MAX_BYTES + 60
