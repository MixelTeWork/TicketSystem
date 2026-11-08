from pathlib import Path
import os

from alembic import command
from alembic.config import Config
import pytest
import sqlalchemy as sa


pytestmark = pytest.mark.release_migration


def test_help_upgrade_preserves_users_and_is_repeatable(app, tmp_path):
    mysql = app.config["TEST_DB_KIND"] == "mysql"
    if mysql:
        from bafser.utils import get_mysql_url

        path = os.environ.get("TEST_MYSQL_MIGRATION_DBPATH")
        assert path and path != os.environ.get("TEST_MYSQL_DBPATH")
        url = get_mysql_url(path)
        assert url.database == "ticketsystem_migration_test"
    else:
        url = sa.URL.create("sqlite", database=str(tmp_path / "help.db"))
    config = Config()
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[2] / "alembic"))
    config.set_main_option("issqlite", "0" if mysql else "1")
    config.set_main_option("sqlalchemy.url", url.render_as_string(hide_password=False).replace("%", "%%"))
    engine = sa.create_engine(url)
    if mysql:
        previous = sa.MetaData()
        previous.reflect(bind=engine)
        previous.drop_all(engine)
    command.upgrade(config, "c6e2a4b89017")
    with engine.begin() as connection:
        connection.execute(sa.text("INSERT INTO User (id, deleted, login, password, name) VALUES (1, 0, 'old', 'saved-hash', 'Old user')"))
    command.upgrade(config, "e3a7c920bd14")
    command.upgrade(config, "e3a7c920bd14")
    with engine.begin() as connection:
        row = connection.execute(sa.text("SELECT login, password, name, helpNoticeBaseline FROM User")).one()
        assert tuple(row) == ("old", "saved-hash", "Old user", 0)
        connection.execute(sa.text("INSERT INTO HelpAcknowledgement (userId, noticeId, acknowledgedAt) VALUES (1, 'upcoming:scanner-access', '2026-11-07 10:00:00')"))
    with pytest.raises(sa.exc.IntegrityError):
        with engine.begin() as connection:
            connection.execute(sa.text("INSERT INTO HelpAcknowledgement (userId, noticeId, acknowledgedAt) VALUES (1, 'upcoming:scanner-access', '2026-11-07 11:00:00')"))
    command.downgrade(config, "c6e2a4b89017")
    command.upgrade(config, "e3a7c920bd14")
    with engine.connect() as connection:
        assert connection.execute(sa.text("SELECT password FROM User")).scalar() == "saved-hash"
    engine.dispose()
