import base64
from datetime import datetime
from io import BytesIO


PNG_BYTES = b"\x89PNG\r\n\x1a\ncontract-image"


def test_image_upload_and_download(logged_in_admin):
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


def test_image_rejects_invalid_encoding(logged_in_admin):
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
    assert response.get_json() == {"msg": "img data is not base64"}


def test_image_requires_payload(logged_in_admin):
    response = logged_in_admin.post("/api/img", json={})

    assert response.status_code == 400
    assert "img" in response.get_json()["msg"]


def test_font_upload_list_and_download(logged_in_admin):
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


def test_font_validation_and_unique_name(logged_in_admin):
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
    assert "already exist" in duplicate.get_json()["msg"]
    assert "is not in" in invalid.get_json()["msg"]


def test_debug_log_contract_and_negative_page(logged_in_admin):
    log_items = logged_in_admin.get("/api/debug/log")
    length = logged_in_admin.get("/api/debug/log_len")
    negative_page = logged_in_admin.get("/api/debug/log?p=-1")

    assert log_items.status_code == 200
    assert isinstance(log_items.get_json(), list)
    assert length.status_code == 200
    assert set(length.get_json()) == {"len"}
    assert negative_page.get_json() == []


def test_missing_font_and_image_return_not_found(logged_in_admin):
    assert logged_in_admin.get("/api/fonts/999999").status_code == 404
    assert logged_in_admin.get("/api/img/999999").status_code == 404


def test_font_rejects_missing_fields_and_file(logged_in_admin):
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
    logged_in_admin, login, user_factory, db_session
):
    from data._roles import Roles
    from data.event import Event

    event = Event.new(
        user_factory("owner", "Owner", Roles.owner),
        "Private image event",
        datetime(2027, 1, 1, 12, 0),
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


def test_all_debug_log_files_are_readable(logged_in_admin):
    for path in (
        "/api/debug/log_info",
        "/api/debug/log_requests",
        "/api/debug/log_errors",
        "/api/debug/log_frontend",
    ):
        response = logged_in_admin.get(path)
        assert response.status_code == 200
        assert response.content_type.startswith("text/html")
