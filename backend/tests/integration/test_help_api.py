from __future__ import annotations

import json
from pathlib import Path
import shutil

import pytest


@pytest.mark.parametrize("path", ["/api/help", "/api/help/search?q=билет", "/api/help/releases", "/api/help/notices", "/api/help/articles/staff-scanner-access", "/api/help/articles/staff-scanner-access/assets/sample.png"])
def test_help_requires_authentication(client, path):
    response = client.get(path)
    assert response.status_code == 401
    assert "no-store" in response.headers["Cache-Control"]


@pytest.mark.parametrize("role,organizer", [("manager", True), ("owner", True), ("clerk", False), ("usher", False)])
def test_help_audiences_and_permissions(client, user_factory, login, role, organizer):
    from data._roles import Roles

    user_factory("reader", "Reader", getattr(Roles, role))
    login("reader")
    response = client.get("/api/help")
    assert response.status_code == 200
    catalog = response.get_json()
    ids = {item["id"] for item in catalog["articles"]}
    assert ("staff-scanner-access" in ids) is organizer
    assert ("ticket-create" in ids) is (organizer or role == "clerk")
    assert "entry-rules" in ids
    assert catalog["audiences"] == (["organizers", "staff"] if organizer else ["staff"])
    assert response.cache_control.private
    assert response.cache_control.no_store
    assert not response.cache_control.public
    release_items = [item for release in client.get("/api/help/releases").get_json() for item in release["items"]]
    assert all(item["audience"] == "staff" for item in release_items) or organizer
    if not organizer:
        assert "scanner-access" not in {item["id"] for item in release_items}
        assert client.get("/api/help/notices").get_json()["items"] == []


def test_admin_and_combined_owner_role_have_full_help(client, logged_in_admin, user_factory, login, db_session):
    from bafser import UserRole
    from data._roles import Roles
    from data.help_content import repository

    assert len(client.get("/api/help").get_json()["articles"]) == len(repository().articles)
    user = user_factory("combined", "Combined", Roles.usher)
    db_session.add(UserRole(userId=user.id, roleId=Roles.owner))
    db_session.commit()
    login("combined")
    assert len(client.get("/api/help").get_json()["articles"]) == len(repository().articles)
    assert client.get("/api/help/articles/ticket-create").status_code == 200


def test_staff_cannot_read_or_search_organizer_material(client, user_factory, login):
    from data._roles import Roles

    user_factory("usher", "Usher", Roles.usher)
    login("usher")
    closed = client.get("/api/help/articles/staff-scanner-access?audience=organizers")
    missing = client.get("/api/help/articles/does-not-exist")
    assert closed.status_code == missing.status_code == 404
    assert closed.get_json() == missing.get_json()
    assert "no-store" in closed.headers["Cache-Control"]
    for query in ("категория", "статистика", "квота", "назначьте"):
        result = client.get("/api/help/search", query_string={"q": query}).get_json()
        assert all(item["audience"] == "staff" for item in result["items"])
        assert "staff-scanner-access" not in {item["id"] for item in result["items"]}
    assert client.get("/api/help/articles/ticket-create").status_code == 404


def test_article_permission_filter_uses_all_effective_permissions(client, user_factory, login, db_session, monkeypatch):
    from dataclasses import replace
    from bafser import UserRole
    from data._roles import Roles
    from data.help_content import repository

    repo = repository()
    article = repo.articles["ticket-create"]
    monkeypatch.setitem(repo.articles, article.id, replace(article, required_permissions=("add_ticket", "change_staff")))
    user = user_factory("clerk", "Clerk", Roles.clerk)
    login("clerk")
    assert client.get("/api/help/articles/ticket-create").status_code == 404
    db_session.add(UserRole(userId=user.id, roleId=Roles.manager))
    db_session.commit()
    assert client.get("/api/help/articles/ticket-create").status_code == 200


def test_search_normalizes_yo_case_and_ranks_titles(logged_in_admin):
    response = logged_in_admin.get("/api/help/search", query_string={"q": "СОТРУДНИКУ"})
    assert response.status_code == 200
    assert response.get_json()["items"][0]["id"] == "staff-scanner-access"
    first = logged_in_admin.get("/api/help/search", query_string={"q": "билетёр"}).get_json()
    second = logged_in_admin.get("/api/help/search", query_string={"q": "БИЛЕТЕР"}).get_json()
    assert first == second and first["total"] > 0
    assert all("snippet" in item and "markdown" not in item for item in first["items"])
    assert logged_in_admin.get("/api/help/search?q=").get_json() == {"items": [], "total": 0}
    assert logged_in_admin.get("/api/help/search", query_string={"q": "x" * 161}).status_code == 400


def test_protected_illustrations_and_path_boundaries(app, client, user_factory, login, tmp_path, monkeypatch):
    from data._roles import Roles
    from data.help_content import HELP_ROOT, HelpRepository

    content = tmp_path / "help"
    shutil.copytree(HELP_ROOT, content)
    for article_id in ("staff-scanner-access", "entry-rules", "ticket-create"):
        folder = content / "articles" / article_id / "assets"
        folder.mkdir(exist_ok=True)
        (folder / "sample.png").write_bytes(b"\x89PNG\r\n\x1a\n")
        (folder / "unsafe.svg").write_text("<svg onload='alert(1)'/>", encoding="utf-8")
    test_repository = HelpRepository(content)
    monkeypatch.setattr("blueprints.help.repository", lambda: test_repository)
    user_factory("usher", "Usher", Roles.usher)
    login("usher")
    assert client.get("/api/help/articles/staff-scanner-access/assets/sample.png").status_code == 404
    assert client.get("/api/help/articles/ticket-create/assets/sample.png").status_code == 404
    response = client.get("/api/help/articles/entry-rules/assets/sample.png")
    assert response.status_code == 200 and response.mimetype == "image/png"
    assert response.cache_control.private
    assert response.cache_control.no_store
    assert not response.cache_control.public
    for name in ("../text.md", "..%2ftext.md", "..%5ctext.md", "unsafe.svg", "sample.png/anything"):
        assert client.get("/api/help/articles/entry-rules/assets/" + name).status_code == 404


def test_existing_user_notices_acknowledge_for_account_on_all_devices(app, client, user_factory, login, db_session):
    from data._roles import Roles
    from data.help_acknowledgement import HelpAcknowledgement

    user = user_factory("manager", "Manager", Roles.manager)
    user.helpNoticeBaseline = 0
    db_session.commit()
    login("manager")
    notices = client.get("/api/help/notices").get_json()["items"]
    assert [notice["id"] for notice in notices] == ["release-2026-11-08:scanner-access"]
    other_device = app.test_client()
    other_device.post("/api/auth", json={"login": "manager", "password": "password"})
    assert other_device.get("/api/help/notices").get_json()["items"] == notices
    ids = {"noticeIds": [notices[0]["id"]]}
    assert client.post("/api/help/notices/acknowledge", json=ids).status_code == 200
    assert other_device.post("/api/help/notices/acknowledge", json=ids).status_code == 200
    assert other_device.get("/api/help/notices").get_json()["items"] == []
    db_session.expire_all()
    assert db_session.query(HelpAcknowledgement).filter_by(userId=user.id).count() == 1
    another = user_factory("another", "Another", Roles.manager)
    another.helpNoticeBaseline = 0
    db_session.commit()
    login("another")
    assert client.get("/api/help/notices").get_json()["items"] == notices


def test_new_users_skip_old_notices_but_receive_future_notices(client, user_factory, login, monkeypatch):
    from data._roles import Roles
    from data.help_content import repository

    user = user_factory("new", "New", Roles.manager)
    repo = repository()
    assert user.helpNoticeBaseline == repo.generation
    login("new")
    assert client.get("/api/help/notices").get_json()["items"] == []
    future = {**repo.releases[0], "id": "future", "noticeGeneration": repo.generation + 1}
    monkeypatch.setattr(repo, "releases", [future, *repo.releases])
    monkeypatch.setattr(repo, "generation", repo.generation + 1)
    assert [item["id"] for item in client.get("/api/help/notices").get_json()["items"]] == ["future:scanner-access"]
    newer = user_factory("newer", "Newer", Roles.manager)
    assert newer.helpNoticeBaseline == repo.generation


@pytest.mark.parametrize("body", [
    {},
    [],
    {"noticeIds": []},
    {"noticeIds": "bad"},
    {"noticeIds": [1]},
    {"noticeIds": ["valid", 1]},
    {"noticeIds": ["release-2026-11-08:scanner-access"] * 31},
    {"noticeIds": ["release-2026-11-08:scanner-access"], "userId": 1},
])
def test_bad_acknowledgements_are_rejected(logged_in_admin, body):
    assert logged_in_admin.post("/api/help/notices/acknowledge", json=body).status_code == 400


@pytest.mark.parametrize("data,content_type", [
    (None, None),
    ("plain text", "text/plain"),
    ('{"noticeIds":', "application/json"),
])
def test_acknowledgements_use_standard_json_body_errors(logged_in_admin, data, content_type):
    response = logged_in_admin.post("/api/help/notices/acknowledge", data=data, content_type=content_type)
    assert response.status_code == 415
    assert response.get_json() == {"msg": "body is not json"}


def test_acknowledgements_reject_json_null(logged_in_admin):
    response = logged_in_admin.post("/api/help/notices/acknowledge", data="null", content_type="application/json")
    assert response.status_code == 400
    assert response.get_json() == {"msg": "body json is not object"}


def test_acknowledgements_accept_the_maximum_list_size(client, user_factory, login, db_session):
    from data._roles import Roles
    from data.help_acknowledgement import HelpAcknowledgement

    user = user_factory("manager", "Manager", Roles.manager)
    user.helpNoticeBaseline = 0
    db_session.commit()
    login("manager")
    response = client.post("/api/help/notices/acknowledge", json={"noticeIds": ["release-2026-11-08:scanner-access"] * 30})
    assert response.status_code == 200
    assert db_session.query(HelpAcknowledgement).filter_by(userId=user.id).count() == 1


def test_unknown_notice_batch_is_atomic(client, user_factory, login, db_session):
    from data._roles import Roles
    from data.help_acknowledgement import HelpAcknowledgement

    user = user_factory("manager", "Manager", Roles.manager)
    user.helpNoticeBaseline = 0
    db_session.commit()
    login("manager")
    assert client.post("/api/help/notices/acknowledge", json={"noticeIds": ["release-2026-11-08:scanner-access", "unknown:unknown"]}).status_code == 404
    assert db_session.query(HelpAcknowledgement).count() == 0


def test_staff_cannot_acknowledge_organizer_notice(client, user_factory, login):
    from data._roles import Roles

    user_factory("staff", "Staff", Roles.clerk)
    login("staff")
    assert client.post("/api/help/notices/acknowledge", json={"noticeIds": ["release-2026-11-08:scanner-access"]}).status_code == 403


def test_history_contains_only_the_published_update(logged_in_admin):
    releases = logged_in_admin.get("/api/help/releases").get_json()
    assert len(releases) == 1
    release = releases[0]
    assert release["id"] == "release-2026-11-08"
    assert release["status"] == "published" and release["date"] == "2026-11-08"
    assert release["approximateDate"] is False and release["version"] is None


def test_catalog_content_and_release_references_are_valid():
    from data.help_content import HelpRepository, HELP_ROOT

    repo = HelpRepository(HELP_ROOT)
    assert repo.articles
    assert not {"help-use", "release-checklist", "ticket-resume", "ticket-quota", "ticket-view"} & repo.articles.keys()
    assert all(article.markdown.strip() and not article.markdown.startswith("# ") for article in repo.articles.values())
    for article in repo.articles.values():
        for target in __import__("re").findall(r"\]\(/help/([a-z0-9-]+)\)", article.markdown):
            assert target in repo.articles


def test_help_api_documentation_describes_public_contracts(app):
    from bafser import get_api_docs

    docs = get_api_docs()
    assert set(docs["/api/help GET"]["response"]) == {"sections", "articles", "audiences"}
    assert "markdown" in docs["/api/help/articles/<articleId> GET"]["response"]
    assert set(docs["/api/help/notices GET"]["response"]) == {"sessionId", "items"}
    assert set(docs["/api/help/notices/acknowledge POST"]["request"]) == {"noticeIds"}
