from concurrent.futures import ThreadPoolExecutor
import threading

import pytest


pytestmark = pytest.mark.mysql


def test_two_devices_acknowledge_once_after_authorization_snapshot(app, admin, db_session, monkeypatch):
    if app.config["TEST_DB_KIND"] != "mysql":
        pytest.skip("requires production-compatible MySQL locking")
    from data.help_acknowledgement import HelpAcknowledgement
    from data.user import User

    admin.helpNoticeBaseline = 0
    db_session.commit()
    before_lock = threading.Barrier(2)
    original = User.get

    def get(*args, **kwargs):
        if kwargs.get("for_update"):
            before_lock.wait(timeout=15)
        return original(*args, **kwargs)

    monkeypatch.setattr(User, "get", get)

    def acknowledge(_):
        with app.test_client() as client:
            assert client.post("/api/auth", json={"login": "admin", "password": "admin"}).status_code == 200
            return client.post("/api/help/notices/acknowledge", json={"noticeIds": ["release-2026-11-08:scanner-access"]}).status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        assert list(executor.map(acknowledge, range(2))) == [200, 200]
    db_session.rollback()
    assert db_session.query(HelpAcknowledgement).count() == 1
