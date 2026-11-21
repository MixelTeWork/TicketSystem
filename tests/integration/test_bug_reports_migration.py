import os
from pathlib import Path

from alembic import command
from alembic.config import Config
import pytest
import sqlalchemy as sa


pytestmark = pytest.mark.release_migration


def test_bug_reports_upgrade_preserves_data_and_can_be_reapplied(app, tmp_path):
    mysql = app.config["TEST_DB_KIND"] == "mysql"
    if mysql:
        from bafser.utils import get_mysql_url

        path = os.environ.get("TEST_MYSQL_MIGRATION_DBPATH")
        assert path and path != os.environ.get("TEST_MYSQL_DBPATH")
        url = get_mysql_url(path)
        assert url.database == "ticketsystem_migration_test"
    else:
        url = sa.URL.create("sqlite", database=str(tmp_path / "reports.db"))
    config = Config()
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[2] / "alembic"))
    config.set_main_option("issqlite", "0" if mysql else "1")
    config.set_main_option("sqlalchemy.url", url.render_as_string(hide_password=False).replace("%", "%%"))
    engine = sa.create_engine(url)
    if mysql:
        previous = sa.MetaData()
        previous.reflect(bind=engine)
        previous.drop_all(engine)
    command.upgrade(config, "e3a7c920bd14")
    with engine.begin() as connection:
        connection.execute(sa.text("INSERT INTO User (id, deleted, login, password, name, helpNoticeBaseline) VALUES (1, 0, 'old', 'saved-hash', 'Old user', 1)"))
        connection.execute(sa.text("INSERT INTO HelpAcknowledgement (userId, noticeId, acknowledgedAt) VALUES (1, 'release:notice', '2026-11-08 10:00:00')"))
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    with engine.begin() as connection:
        assert connection.execute(sa.text("SELECT password FROM User")).scalar() == "saved-hash"
        assert connection.execute(sa.text("SELECT noticeId FROM HelpAcknowledgement")).scalar() == "release:notice"
        assert connection.execute(sa.text("SELECT COUNT(*) FROM BugReport")).scalar() == 0
        connection.execute(sa.text("INSERT INTO BugReport (userId, description, page, userAgent, createdAt) VALUES (1, 'Ошибка 🎫', '/scanner/1', 'Browser', '2026-11-08 12:00:00')"))
        assert connection.execute(sa.text("SELECT description FROM BugReport")).scalar() == "Ошибка 🎫"
    command.downgrade(config, "e3a7c920bd14")
    command.upgrade(config, "head")
    with engine.connect() as connection:
        assert connection.execute(sa.text("SELECT password FROM User")).scalar() == "saved-hash"
        assert connection.execute(sa.text("SELECT noticeId FROM HelpAcknowledgement")).scalar() == "release:notice"
    engine.dispose()
