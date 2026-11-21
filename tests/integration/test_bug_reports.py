from datetime import datetime, timezone

import pytest


@pytest.mark.parametrize("method", ["GET", "POST"])
def test_bug_reports_require_authentication(client, method):
    assert client.open("/api/bug_reports", method=method, json={"description": "Problem", "page": "/"}).status_code == 401


@pytest.mark.parametrize("role", ["owner", "manager", "clerk", "usher"])
def test_users_can_submit_but_only_admin_can_read(client, user_factory, login, db_session, role, monkeypatch):
    import data.bug_report as model
    from data._roles import Roles
    from data.bug_report import BugReport

    user = user_factory("reporter", "Автор", getattr(Roles, role))
    login("reporter")
    now = datetime(2026, 11, 8, 12, 34, 56, 823456, tzinfo=timezone.utc)
    monkeypatch.setattr(model, "get_datetime_utc", lambda: now)
    response = client.post("/api/bug_reports", json={
        "description": "  Не работает\nПечать билета  ", "page": "/events/42/tickets",
        "userId": 1, "userAgent": "Forged", "createdAt": "2000-01-01",
    }, headers={"User-Agent": "Test browser"})
    assert response.status_code == 200
    assert response.cache_control.private and response.cache_control.no_store
    db_session.rollback()
    report = db_session.query(BugReport).one()
    assert report.id == response.get_json()["id"]
    assert report.userId == user.id
    assert report.description == "Не работает\nПечать билета"
    assert report.page == "/events/42/tickets"
    assert report.userAgent == "Test browser"
    assert report.createdAt == datetime(2026, 11, 8, 12, 34, 56)
    assert client.get("/api/bug_reports").status_code == 403


@pytest.mark.parametrize("data,status", [
    ({}, 400), ({"description": "a"}, 400), ({"description": 5, "page": "/"}, 400),
    ({"description": "a", "page": []}, 400), ([], 400),
    ({"description": " \n ", "page": "/"}, 400),
    ({"description": "я" * 5001, "page": "/"}, 400),
    ({"description": "a", "page": "https://example.com"}, 400),
    ({"description": "a", "page": "//example.com"}, 400),
    ({"description": "a", "page": "/auth?token=secret"}, 400),
    ({"description": "a", "page": "/#private"}, 400),
    ({"description": "a", "page": "/\\example.com"}, 400),
    ({"description": "a", "page": "/\n"}, 400),
    ({"description": "a", "page": "/" * 2049}, 400),
])
def test_invalid_reports_are_not_saved(logged_in_admin, db_session, data, status):
    from data.bug_report import BugReport

    assert logged_in_admin.post("/api/bug_reports", json=data).status_code == status
    assert db_session.query(BugReport).count() == 0


def test_long_browser_header_is_bounded_without_losing_report(logged_in_admin, db_session):
    from data.bug_report import BugReport

    response = logged_in_admin.post("/api/bug_reports", json={"description": "я" * 5000, "page": "/"}, headers={"User-Agent": "a" * 600})
    assert response.status_code == 200
    report = db_session.query(BugReport).one()
    assert len(report.description) == 5000
    assert len(report.userAgent) == 512


def test_admin_list_is_paginated_newest_first_and_keeps_deleted_authors(client, user_factory, login, db_session):
    from data._roles import Roles
    from data.bug_report import BugReport

    user = user_factory("reporter", "Автор", Roles.usher)
    db_session.add_all([BugReport(userId=user.id, description=f"Ошибка {i}", page="/scanner/42", userAgent="Browser", createdAt=datetime(2026, 11, 8, 12)) for i in range(26)])
    user.deleted = True
    db_session.commit()
    login("admin", "admin")
    first = client.get("/api/bug_reports").get_json()
    second = client.get("/api/bug_reports?p=1").get_json()
    assert first["total"] == 26 and first["pages"] == 2
    assert len(first["items"]) == 25 and len(second["items"]) == 1
    assert [item["description"] for item in first["items"] + second["items"]] == [f"Ошибка {i}" for i in reversed(range(26))]
    assert first["items"][0] == {
        "id": first["items"][0]["id"], "userId": user.id, "userName": "Автор", "userLogin": "reporter",
        "description": "Ошибка 25", "page": "/scanner/42", "userAgent": "Browser", "createdAt": "2026-11-08T12:00:00Z",
    }
    assert client.get("/api/bug_reports?p=999999999").get_json()["items"] == []


@pytest.mark.parametrize("page", ["-1", "NaN", "1.5", "", "١", "1000000000"])
def test_invalid_list_page(logged_in_admin, page):
    assert logged_in_admin.get("/api/bug_reports", query_string={"p": page}).status_code == 400


def test_empty_admin_list(logged_in_admin):
    assert logged_in_admin.get("/api/bug_reports").get_json() == {"items": [], "total": 0, "pages": 1}
