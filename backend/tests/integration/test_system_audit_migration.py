import os
from pathlib import Path

from alembic import command
from alembic.config import Config
import pytest
import sqlalchemy as sa


pytestmark = pytest.mark.release_migration

PREVIOUS_REVISION = "a4f10b8c2e63"
SYSTEM_AUTHOR_REVISION = "b9d20f7a6c31"


def test_system_audit_migration_preserves_history_and_rejects_unsafe_downgrade(app, tmp_path: Path):
    mysql = app.config["TEST_DB_KIND"] == "mysql"
    if mysql:
        from bafser.utils import get_mysql_url

        path = os.environ.get("TEST_MYSQL_MIGRATION_DBPATH")
        assert path and path != os.environ.get("TEST_MYSQL_DBPATH")
        url = get_mysql_url(path)
        assert url.database == "ticketsystem_migration_test"
    else:
        url = sa.URL.create("sqlite", database=str(tmp_path / "system-audit.db"))
    config = Config()
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[2] / "alembic"))
    config.set_main_option("issqlite", "0" if mysql else "1")
    config.set_main_option("sqlalchemy.url", url.render_as_string(hide_password=False).replace("%", "%%"))
    engine = sa.create_engine(url)

    def author_is_nullable() -> bool:
        column = next(column for column in sa.inspect(engine).get_columns("Log") if column["name"] == "userId")
        return column["nullable"]

    def structure():
        schema = sa.inspect(engine)
        return (
            schema.get_indexes("Log"), schema.get_foreign_keys("Log"),
            schema.get_pk_constraint("Log"), schema.get_unique_constraints("Log"),
        )

    try:
        if mysql:
            previous = sa.MetaData()
            previous.reflect(bind=engine)
            previous.drop_all(engine)
        command.upgrade(config, PREVIOUS_REVISION)
        assert author_is_nullable() is False
        before = structure()
        with engine.begin() as connection:
            connection.execute(sa.text(
                "INSERT INTO User (id, deleted, login, password, name, helpNoticeBaseline) "
                "VALUES (1, 0, 'historical-admin', 'saved-hash', 'Historical admin', 0)"
            ))
            connection.execute(sa.text(
                "INSERT INTO Log (id, date, actionCode, userId, userName, tableName, recordId, changes) "
                "VALUES (1, '2026-11-18 12:00:00', 'added', 1, 'Historical admin', 'Ticket', 1, '[]')"
            ))

        command.upgrade(config, SYSTEM_AUTHOR_REVISION)
        command.upgrade(config, SYSTEM_AUTHOR_REVISION)
        assert author_is_nullable() is True
        assert structure() == before
        command.downgrade(config, PREVIOUS_REVISION)
        assert author_is_nullable() is False
        assert structure() == before
        command.upgrade(config, SYSTEM_AUTHOR_REVISION)
        assert author_is_nullable() is True
        assert structure() == before

        with engine.begin() as connection:
            historical = connection.execute(sa.text("SELECT userId, userName, changes FROM Log WHERE id = 1")).one()
            assert tuple(historical) == (1, "Historical admin", "[]")
            assert connection.execute(sa.text("SELECT password FROM User WHERE id = 1")).scalar_one() == "saved-hash"
            connection.execute(sa.text(
                "INSERT INTO Log (id, date, actionCode, userId, userName, tableName, recordId, changes) "
                "VALUES (2, '2026-11-19 12:00:00', 'added', NULL, 'System', 'Ticket', 2, '[]')"
            ))

        with pytest.raises(RuntimeError, match="system audit records have NULL authors"):
            command.downgrade(config, PREVIOUS_REVISION)

        assert author_is_nullable() is True
        assert structure() == before
        with engine.connect() as connection:
            assert connection.execute(sa.text("SELECT version_num FROM alembic_version")).scalar_one() == SYSTEM_AUTHOR_REVISION
            assert connection.execute(sa.text("SELECT userId FROM Log WHERE id = 1")).scalar_one() == 1
            assert connection.execute(sa.text("SELECT userId FROM Log WHERE id = 2")).scalar_one() is None
            assert connection.execute(sa.text("SELECT COUNT(*) FROM Log")).scalar_one() == 2
    finally:
        engine.dispose()
