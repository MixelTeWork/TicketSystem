import importlib.util
from datetime import datetime, timedelta
from pathlib import Path

from alembic import command
from alembic.migration import MigrationContext
from alembic.operations import Operations
import pytest
import sqlalchemy as sa


MIGRATION_PATH = Path(__file__).resolve().parents[2] / "alembic/versions/2026_10_12_d7b91c3e5a20_dates_to_utc.py"


def load_migration():
    spec = importlib.util.spec_from_file_location("utc_migration", MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def seed_legacy_dates(db_session, admin):
    from bafser import Log
    from data.event import Event
    from data.font import Font
    from data.img import Image
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    microsecond = 123456 if db_session.get_bind().dialect.name == "sqlite" else 0
    old = datetime(2026, 1, 1, 1, 23, 45, microsecond)
    event = Event(name="Legacy", date=old)
    db_session.add(event)
    db_session.flush()
    ticket_type = TicketType(eventId=event.id, name="Main", number=0)
    db_session.add(ticket_type)
    db_session.flush()
    image = Image(name="Legacy", type="png", creationDate=old, createdById=admin.id, accessEventId=event.id)
    image.deletionDate = old
    db_session.add_all([
        image,
        Font(name="Legacy", type="ttf", creationDate=old, deletionDate=old, createdById=admin.id),
    ])
    for index in range(5):
        db_session.add(Ticket(
            createdDate=old, createdById=admin.id, eventId=event.id, typeId=ticket_type.id,
            code=f"LEGACY-{index}", updatedDate=old if index == 0 else None,
            scannedDate=old if index == 0 else None,
        ))
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
    db_session.add(Log(date=old, actionCode="updated", userId=admin.id, userName=admin.name,
                       tableName="Ticket", recordId=1, changes=changes))
    db_session.commit()
    return old, changes


def snapshot(engine, migration):
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


def assert_shifted(before, after, migration, hours):
    for name, columns in migration.DATE_COLUMNS.items():
        assert len(before[name]) == len(after[name])
        for old, new in zip(before[name], after[name]):
            assert new["id"] == old["id"]
            for column in columns:
                assert new[column] == (old[column] + timedelta(hours=hours) if old[column] else None)
            if name == "Ticket":
                assert new["code"] == old["code"]


def test_alembic_converts_legacy_dates_once_and_can_reverse(app, db_session, admin):
    from bafser.alembic import create_alembic_config

    migration = load_migration()
    old, changes = seed_legacy_dates(db_session, admin)
    engine = db_session.get_bind()
    before = snapshot(engine, migration)
    config = create_alembic_config(app.config["TEST_DB_KIND"] == "sqlite")
    command.stamp(config, migration.down_revision)
    try:
        command.upgrade(config, "head")
        after = snapshot(engine, migration)
        assert_shifted(before, after, migration, -3)
        utc = (old - timedelta(hours=3)).isoformat() + "Z"
        log_changes = after["Log"][0]["changes"]
        assert log_changes[:3] == [
            ["createdDate", utc, utc], ["updatedDate", None, utc],
            ["scannedDate", "invalid historical date", utc],
        ]
        assert log_changes[3:] == changes[3:]
        command.upgrade(config, "head")
        assert snapshot(engine, migration) == after
        command.downgrade(config, migration.down_revision)
        restored = snapshot(engine, migration)
        assert_shifted(after, restored, migration, 3)
        assert restored["Log"][0]["changes"][0] == ["createdDate", old.isoformat(), old.isoformat()]
    finally:
        # Leave the shared test schema at its original head revision.
        command.stamp(config, "head")


def test_utc_migration_visits_every_batch(db_session, admin, monkeypatch):
    migration = load_migration()
    seed_legacy_dates(db_session, admin)
    engine = db_session.get_bind()
    before = snapshot(engine, migration)
    monkeypatch.setattr(migration, "BATCH_SIZE", 2)
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
    assert_shifted(before, snapshot(engine, migration), migration, -3)


@pytest.mark.parametrize("direction", ["upgrade", "downgrade"])
def test_out_of_range_date_is_rejected_before_any_changes(db_session, admin, direction):
    from data.font import Font

    migration = load_migration()
    seed_legacy_dates(db_session, admin)
    engine = db_session.get_bind()
    minimum_year = 1000 if engine.dialect.name == "mysql" else 1
    invalid = datetime(minimum_year, 1, 1, 1) if direction == "upgrade" else datetime(9999, 12, 31, 23)
    font = db_session.query(Font).one()
    font.creationDate = invalid
    db_session.commit()
    before = snapshot(engine, migration)
    # Catch inside the transaction: preflight must prevent writes even if the
    # caller commits rather than rolling back after catching the error.
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            with pytest.raises(RuntimeError, match=r"Font\[.*\].creationDate.*out of range"):
                getattr(migration, direction)()
    assert snapshot(engine, migration) == before
