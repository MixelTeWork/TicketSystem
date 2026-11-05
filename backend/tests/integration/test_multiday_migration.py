"""Upgrade actual pre-sprint schemas, separately from the application's test DB."""
from __future__ import annotations

from typing import TYPE_CHECKING

import os
import importlib.util
from datetime import date, datetime, timedelta
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
import pytest
import sqlalchemy as sa

if TYPE_CHECKING:
    from flask import Flask


pytestmark = pytest.mark.release_migration


PREVIOUS_HEAD = "f2c8a16d904e"
MULTIDAY_HEAD = "a8d3e5f70124"
CALENDAR_HEAD = "c6e2a4b89017"


def test_event_calendar_date_upgrade_boundaries(app: Flask, tmp_path: Path):
    mysql = app.config["TEST_DB_KIND"] == "mysql"
    if mysql:
        from bafser.utils import get_mysql_url
        path = os.environ.get("TEST_MYSQL_MIGRATION_DBPATH")
        assert path and path != os.environ.get("TEST_MYSQL_DBPATH")
        url = get_mysql_url(path)
        assert url.database == "ticketsystem_migration_test"
    else:
        url = sa.URL.create("sqlite", database=str(tmp_path / "event_calendar.db"))
    engine = sa.create_engine(url)
    config = Config()
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[2] / "alembic"))
    config.set_main_option("issqlite", "0" if mysql else "1")
    config.set_main_option("sqlalchemy.url", url.render_as_string(hide_password=False).replace("%", "%%"))
    instants = [datetime(1000, 1, 1), datetime(9999, 12, 31, 20, 59, 59),
                datetime(2026, 10, 31, 20, 59, 59), datetime(2026, 10, 31, 21),
                datetime(2026, 12, 31, 22), datetime(2028, 2, 28, 22)]
    expected = [(instant + timedelta(hours=3)).date() for instant in instants]
    try:
        if mysql:
            old = sa.MetaData()
            old.reflect(bind=engine)
            old.drop_all(engine)
        command.upgrade(config, MULTIDAY_HEAD)
        metadata = sa.MetaData()
        event = sa.Table("Event", metadata, autoload_with=engine)
        with engine.begin() as connection:
            connection.execute(event.insert(), [
                {"id": index, "name": f"Boundary {index}", "date": instant, "endDate": day,
                 "deleted": index == 2, "lastTicketNumber": 9, "lastTypeNumber": 3}
                for index, (instant, day) in enumerate(zip(instants, expected), start=1)
            ])
        command.upgrade(config, CALENDAR_HEAD)
        command.upgrade(config, CALENDAR_HEAD)
        current = sa.Table("Event", sa.MetaData(), autoload_with=engine)
        with engine.connect() as connection:
            rows = connection.execute(sa.select(current).order_by(current.c.id)).mappings().all()
            assert [row["date"] for row in rows] == expected
            assert [row["endDate"] for row in rows] == expected
            assert all(type(row["date"]) is date and row["lastTicketNumber"] == 9 for row in rows)
            assert rows[1]["deleted"]
    finally:
        engine.dispose()


def test_sqlite_upgrade_failure_restores_foreign_key_checks(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    path = Path(__file__).resolve().parents[2] / "alembic/versions/2026_10_26_a8d3e5f70124_multiday_tickets.py"
    spec = importlib.util.spec_from_file_location("multiday_failure", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = sa.create_engine(sa.URL.create("sqlite", database=str(tmp_path / "failure.db")))
    try:
        with engine.connect() as connection:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            connection.exec_driver_sql("CREATE TABLE sentinel (id INTEGER PRIMARY KEY)")
            connection.commit()
            context = MigrationContext.configure(connection, opts={"transaction_per_migration": True})
            def fail():
                assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar() == 0
                connection.exec_driver_sql("INSERT INTO sentinel (id) VALUES (1)")
                raise RuntimeError("injected upgrade error")
            monkeypatch.setattr(migration, "_upgrade_schema_and_data", fail)
            with Operations.context(context):
                with context.begin_transaction(_per_migration=True):
                    with pytest.raises(RuntimeError, match="injected upgrade error"):
                        migration.upgrade()
            assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1
            assert connection.exec_driver_sql("SELECT count(*) FROM sentinel").scalar() == 0
    finally:
        engine.dispose()


def test_legacy_multiday_upgrade_preserves_data(app: Flask, tmp_path: Path):
    mysql = app.config["TEST_DB_KIND"] == "mysql"
    if mysql:
        from bafser.utils import get_mysql_url
        path = os.environ.get("TEST_MYSQL_MIGRATION_DBPATH")
        assert path, "MySQL legacy migration requires isolated TEST_MYSQL_MIGRATION_DBPATH"
        assert path != os.environ.get("TEST_MYSQL_DBPATH")
        url = get_mysql_url(path)
        assert url.database == "ticketsystem_migration_test", "Refusing a non-migration database"
    else:
        url = sa.URL.create("sqlite", database=str(tmp_path / "legacy.db"))
    engine = sa.create_engine(url)
    config = Config()
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[2] / "alembic"))
    config.set_main_option("issqlite", "0" if mysql else "1")
    config.set_main_option("sqlalchemy.url", url.render_as_string(hide_password=False).replace("%", "%%"))
    try:
        if mysql:
            old = sa.MetaData()
            old.reflect(bind=engine)
            old.drop_all(engine)
        command.upgrade(config, PREVIOUS_HEAD)
        metadata = sa.MetaData()
        metadata.reflect(bind=engine)
        tables = metadata.tables
        old_time = datetime(2026, 10, 30, 22, 15, 0)
        scan_time = datetime(2026, 9, 10, 4, 0, 0)
        with engine.begin() as connection:
            connection.execute(tables["User"].insert().values(id=1, login="legacy", name="Legacy", password="unused"))
            connection.execute(tables["Event"].insert(), [
                {"id": 1, "name": "Active", "date": old_time, "deleted": False, "lastTicketNumber": 70, "lastTypeNumber": 3},
                {"id": 2, "name": "Deleted", "date": old_time, "deleted": True, "lastTicketNumber": 12, "lastTypeNumber": 1},
            ])
            connection.execute(tables["Image"].insert().values(id=1, name="Design", type="png", creationDate=old_time,
                                                               createdById=1, accessEventId=1))
            connection.execute(tables["TicketType"].insert(), [
                {"id": 1, "eventId": 1, "name": "Same", "number": 0, "price": 0, "deleted": False, "imageId": 1, "pattern": {"width": 100}},
                {"id": 2, "eventId": 1, "name": "Same", "number": 1, "price": None, "deleted": True, "imageId": None, "pattern": None},
                {"id": 3, "eventId": 2, "name": "Other", "number": 0, "price": 500, "deleted": True, "imageId": None, "pattern": None},
            ])
            for index, (scanned, timestamp, author) in enumerate([
                (True, scan_time, 1), (True, None, None), (False, scan_time, 1), (False, None, None),
                (True, scan_time, None), (True, None, 1),
            ], start=1):
                connection.execute(tables["Ticket"].insert().values(
                    id=index, createdDate=old_time, createdById=1, eventId=2 if index == 6 else 1,
                    typeId=3 if index == 6 else (2 if index == 5 else 1),
                    code=f"OLD-60101-{index}", scanned=scanned, scannedDate=timestamp, scannedById=author,
                    deleted=index == 5, price=0 if index == 1 else None, personName="Фёдор", person_name_search="fedor",
                ))
            before = {name: [dict(row) for row in connection.execute(sa.select(tables[name]).order_by(tables[name].c.id)).mappings()]
                      for name in ("Event", "TicketType", "Ticket", "Image")}
        command.upgrade(config, MULTIDAY_HEAD)
        command.upgrade(config, MULTIDAY_HEAD)  # A repeated upgrade is a no-op.
        current = sa.MetaData()
        current.reflect(bind=engine)
        with engine.connect() as connection:
            after = {name: [dict(row) for row in connection.execute(sa.select(current.tables[name]).order_by(current.tables[name].c.id)).mappings()]
                     for name in before}
            for name, rows in before.items():
                for old, new in zip(rows, after[name]):
                    assert {key: new[key] for key in old} == old, f"Changed legacy {name}[{old['id']}]"
            assert [row["endDate"] for row in after["Event"]] == [date(2026, 10, 31)] * 2
            day_rows = connection.execute(sa.select(current.tables["EventDay"])).mappings().all()
            assert {(row["eventId"], row["dayOffset"]) for row in day_rows} == {(1, 0), (2, 0)}
            categories = connection.execute(sa.select(current.tables["TicketCategory"])).mappings().all()
            assert len(categories) == 3  # Equal names do not merge categories.
            for variant in after["TicketType"]:
                category = next(row for row in categories if row["id"] == variant["categoryId"])
                assert (category["name"], category["deleted"], category["eventId"]) == (variant["name"], variant["deleted"], variant["eventId"])
                assert variant["daysKey"] == "0" and variant["quantity"] is None
            assert connection.scalar(sa.select(sa.func.count()).select_from(current.tables["TicketTypeDay"])) == 3
            scans = {row["ticketId"]: row for row in connection.execute(sa.select(current.tables["TicketCheckin"])).mappings()}
            assert set(scans) == {1, 2, 5, 6}
            assert (scans[1]["checkedAt"], scans[1]["checkedById"]) == (scan_time, 1)
            assert (scans[2]["checkedAt"], scans[2]["checkedById"]) == (None, None)
            assert scans[5]["checkedById"] is None and scans[6]["checkedAt"] is None
            assert all(row["merchIssuedAt"] is None and row["merchIssuedById"] is None for row in after["Ticket"])
            assert connection.scalar(sa.select(sa.func.count()).select_from(current.tables["RequestOperation"])) == 0
            assert connection.scalar(sa.select(sa.func.count()).select_from(current.tables["Log"])) == 0
        # Apply the subsequent DATE migration to actual related legacy records.
        # QR codes, prices, checkins, deleted records and audit history survive.
        with engine.connect() as connection:
            snapshots = {name: [dict(row) for row in connection.execute(sa.select(table).order_by(table.c.id)).mappings()]
                         for name, table in current.tables.items() if "id" in table.c and name != "alembic_version"}
        command.upgrade(config, CALENDAR_HEAD)
        command.upgrade(config, CALENDAR_HEAD)
        converted = sa.MetaData()
        converted.reflect(bind=engine)
        assert isinstance(converted.tables["Event"].c.date.type, sa.Date)
        assert not isinstance(converted.tables["Event"].c.date.type, sa.DateTime)
        with engine.connect() as connection:
            for name, rows in snapshots.items():
                actual = [dict(row) for row in connection.execute(sa.select(converted.tables[name]).order_by(converted.tables[name].c.id)).mappings()]
                expected = [{**row, "date": date(2026, 10, 31)} if name == "Event" else row for row in rows]
                assert actual == expected, f"Calendar conversion changed {name}"
            if not mysql:
                assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []
    finally:
        engine.dispose()
