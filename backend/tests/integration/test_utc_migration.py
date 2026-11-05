from __future__ import annotations

from typing import TYPE_CHECKING

import importlib.util
import os
from datetime import datetime, timedelta
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
import pytest
import sqlalchemy as sa

if TYPE_CHECKING:
    from flask import Flask
    from sqlalchemy.engine import Engine
    from types import ModuleType
    from typing import Any


pytestmark = pytest.mark.release_migration


MIGRATION_PATH = Path(__file__).resolve().parents[2] / "alembic/versions/2026_10_12_d7b91c3e5a20_dates_to_utc.py"


def load_migration():
    spec = importlib.util.spec_from_file_location("utc_migration", MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def legacy_database(app: Flask, tmp_path: Path):
    # Exercise the historical DATETIME schema, never the current DATE model.
    mysql = app.config["TEST_DB_KIND"] == "mysql"
    if mysql:
        from bafser.utils import get_mysql_url
        path = os.environ.get("TEST_MYSQL_MIGRATION_DBPATH")
        assert path and path != os.environ.get("TEST_MYSQL_DBPATH")
        url = get_mysql_url(path)
        assert url.database == "ticketsystem_migration_test"
    else:
        url = sa.URL.create("sqlite", database=str(tmp_path / "utc_legacy.db"))
    engine = sa.create_engine(url)
    config = Config()
    config.set_main_option("script_location", str(MIGRATION_PATH.parents[1]))
    config.set_main_option("issqlite", "0" if mysql else "1")
    config.set_main_option("sqlalchemy.url", url.render_as_string(hide_password=False).replace("%", "%%"))
    try:
        if mysql:
            previous = sa.MetaData()
            previous.reflect(bind=engine)
            previous.drop_all(engine)
        command.upgrade(config, load_migration().down_revision)
        yield engine, config
    finally:
        engine.dispose()


def seed_legacy_dates(engine: Engine):
    microsecond = 123456 if engine.dialect.name == "sqlite" else 0
    old = datetime(2026, 1, 1, 1, 23, 45, microsecond)
    changes = [
        ["createdDate", old.isoformat(), old.isoformat() + "+00:00"],
        ["updatedDate", None, old.isoformat() + "+03:00"],
        ["scannedDate", "invalid historical date", old.isoformat()],
        ["personName", old.isoformat(), "Person"],
        ["pattern", None, {"date": old.isoformat()}],
        ["unknownDate", None, old.isoformat()],
        ["createdDate"],
        None,
    ]
    metadata = sa.MetaData()
    metadata.reflect(bind=engine)
    tables = metadata.tables
    with engine.begin() as connection:
        connection.execute(tables["User"].insert().values(id=1, login="legacy", name="Legacy", password="unused"))
        connection.execute(tables["Event"].insert().values(id=1, name="Legacy", date=old))
        connection.execute(tables["TicketType"].insert().values(id=1, eventId=1, name="Main", number=0))
        connection.execute(tables["Image"].insert().values(name="Legacy", type="png", creationDate=old,
                           deletionDate=old, createdById=1, accessEventId=1))
        connection.execute(tables["Font"].insert().values(name="Legacy", type="ttf", creationDate=old,
                           deletionDate=old, createdById=1))
        connection.execute(tables["Ticket"].insert(), [
            {"createdDate": old, "createdById": 1, "eventId": 1, "typeId": 1, "code": f"LEGACY-{index}",
             "updatedDate": old if index == 0 else None, "scannedDate": old if index == 0 else None}
            for index in range(5)
        ])
        connection.execute(tables["Log"].insert().values(date=old, actionCode="updated", userId=1, userName="Legacy",
                           tableName="Ticket", recordId=1, changes=changes))
    return old, changes


def snapshot(engine: Engine, migration: ModuleType):
    with engine.connect() as connection:
        tables = sa.MetaData()
        result = {}
        for name, columns in migration.DATE_COLUMNS.items():
            table = sa.Table(name, tables, autoload_with=connection)
            fields = [table.c.id, *(table.c[column] for column in columns)]
            if name == "Log":
                fields.append(table.c.changes)
            if name == "Ticket":
                fields.append(table.c.code)
            result[name] = [dict(row) for row in connection.execute(sa.select(*fields).order_by(table.c.id)).mappings()]
        return result


def assert_shifted(before: dict[str, list[dict[str, Any]]], after: dict[str, list[dict[str, Any]]], migration: ModuleType, hours: int):
    for name, columns in migration.DATE_COLUMNS.items():
        assert len(before[name]) == len(after[name])
        for old, new in zip(before[name], after[name]):
            assert new["id"] == old["id"]
            for column in columns:
                assert new[column] == (old[column] + timedelta(hours=hours) if old[column] else None)
            if name == "Ticket":
                assert new["code"] == old["code"]


def test_alembic_converts_legacy_dates_once_and_can_reverse(legacy_database: tuple[Engine, Config]):
    engine, config = legacy_database
    migration = load_migration()
    old, changes = seed_legacy_dates(engine)
    before = snapshot(engine, migration)
    command.upgrade(config, migration.revision)
    after = snapshot(engine, migration)
    assert_shifted(before, after, migration, -3)
    utc = (old - timedelta(hours=3)).isoformat() + "Z"
    log_changes = after["Log"][0]["changes"]
    assert log_changes[:3] == [
        ["createdDate", utc, utc], ["updatedDate", None, utc],
        ["scannedDate", "invalid historical date", utc],
    ]
    assert log_changes[3:] == changes[3:]
    command.upgrade(config, migration.revision)
    assert snapshot(engine, migration) == after
    command.downgrade(config, migration.down_revision)
    restored = snapshot(engine, migration)
    assert_shifted(after, restored, migration, 3)
    assert restored["Log"][0]["changes"][0] == ["createdDate", old.isoformat(), old.isoformat()]


def test_utc_migration_visits_every_batch(legacy_database: tuple[Engine, Config], monkeypatch: pytest.MonkeyPatch):
    engine, _ = legacy_database
    migration = load_migration()
    seed_legacy_dates(engine)
    before = snapshot(engine, migration)
    monkeypatch.setattr(migration, "BATCH_SIZE", 2)
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
    assert_shifted(before, snapshot(engine, migration), migration, -3)


@pytest.mark.parametrize("direction", ["upgrade", "downgrade"])
def test_out_of_range_date_is_rejected_before_any_changes(legacy_database: tuple[Engine, Config], direction: str):
    engine, _ = legacy_database

    migration = load_migration()
    seed_legacy_dates(engine)
    minimum_year = 1000 if engine.dialect.name == "mysql" else 1
    invalid = datetime(minimum_year, 1, 1, 1) if direction == "upgrade" else datetime(9999, 12, 31, 23)
    font = sa.Table("Font", sa.MetaData(), autoload_with=engine)
    with engine.begin() as connection:
        connection.execute(font.update().values(creationDate=invalid))
    before = snapshot(engine, migration)
    # Catch inside the transaction: preflight must prevent writes even if the
    # caller commits rather than rolling back after catching the error.
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            with pytest.raises(RuntimeError, match=r"Font\[.*\].creationDate.*out of range"):
                getattr(migration, direction)()
    assert snapshot(engine, migration) == before
