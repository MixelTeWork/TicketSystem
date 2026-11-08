"""Store the event's Moscow calendar date instead of a UTC timestamp.

Revision ID: c6e2a4b89017
Revises: a8d3e5f70124

Run with writers stopped. Historical audit timestamps remain unchanged.
"""

from datetime import timedelta

from alembic import op
import sqlalchemy as sa


revision = "c6e2a4b89017"
down_revision = "a8d3e5f70124"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_context().as_sql:
        raise RuntimeError("Event calendar date conversion requires an online connection")
    bind = op.get_bind()
    sqlite = bind.dialect.name == "sqlite"
    if sqlite:
        with op.get_context().autocommit_block():
            bind.exec_driver_sql("PRAGMA foreign_keys=OFF")
    succeeded = False
    try:
        op.add_column("Event", sa.Column("_calendarDate", sa.Date(), nullable=True))
        event = sa.table("Event", sa.column("id", sa.Integer()), sa.column("date", sa.DateTime()),
                         sa.column("_calendarDate", sa.Date()))
        for row in bind.execute(sa.select(event.c.id, event.c.date)).mappings():
            day = (row["date"] + timedelta(hours=3)).date()
            bind.execute(event.update().where(event.c.id == row["id"]).values(_calendarDate=day))
        # A temporary DATE column avoids SQLite's CAST(datetime AS DATE), which
        # produces a year integer rather than a valid ISO calendar date.
        with op.batch_alter_table("Event") as batch:
            batch.drop_column("date")
            batch.alter_column("_calendarDate", new_column_name="date", existing_type=sa.Date(), nullable=False)
        succeeded = True
    except BaseException:
        if sqlite:
            bind.connection.driver_connection.rollback()
        raise
    finally:
        if sqlite:
            with op.get_context().autocommit_block():
                bind.exec_driver_sql("PRAGMA foreign_keys=ON")
                if succeeded and bind.exec_driver_sql("PRAGMA foreign_key_check").first() is not None:
                    raise RuntimeError("Foreign key validation failed after event date conversion")


def downgrade() -> None:
    raise RuntimeError("Event times were discarded; restore the pre-upgrade backup to recover them")
