"""Stable event days, ticket categories, checkins and atomic request results.

Revision ID: a8d3e5f70124
Revises: f2c8a16d904e

Run with old writers stopped. Legacy scan columns are intentionally retained,
including contradictory/unknown history; only scanned=True creates a checkin.
"""

from datetime import timedelta

from alembic import op
import sqlalchemy as sa


revision = "a8d3e5f70124"
down_revision = "f2c8a16d904e"
branch_labels = None
depends_on = None

OPTIONS = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}


def _id():
    return sa.Column("id", sa.Integer(), primary_key=True, unique=True, autoincrement=True, nullable=False)


def upgrade() -> None:
    if op.get_context().as_sql:
        raise RuntimeError("Multiday backfill requires an online database connection")
    bind = op.get_bind()
    sqlite = bind.dialect.name == "sqlite"
    if sqlite:
        # Alembic's batch ALTER rebuilds referenced parent tables. SQLite
        # requires foreign_keys OFF outside a transaction for those rebuilds.
        with op.get_context().autocommit_block():
            bind.exec_driver_sql("PRAGMA foreign_keys=OFF")
    succeeded = False
    try:
        _upgrade_schema_and_data()
        succeeded = True
    except BaseException:
        if sqlite:
            # Roll back pending DML before leaving the pragma block. SQLite DDL
            # may already be committed, so a failed upgrade still needs repair
            # or the pre-upgrade backup, but never leaves FK checks disabled.
            bind.connection.driver_connection.rollback()
        raise
    finally:
        if sqlite:
            with op.get_context().autocommit_block():
                bind.exec_driver_sql("PRAGMA foreign_keys=ON")
                if succeeded and bind.exec_driver_sql("PRAGMA foreign_key_check").first() is not None:
                    raise RuntimeError("Foreign key validation failed after multiday upgrade")


def _upgrade_schema_and_data() -> None:
    bind = op.get_bind()
    op.add_column("Event", sa.Column("endDate", sa.Date(), nullable=True))
    event = sa.table("Event", sa.column("id", sa.Integer()), sa.column("date", sa.DateTime()), sa.column("endDate", sa.Date()))
    for row in bind.execute(sa.select(event.c.id, event.c.date)).mappings():
        bind.execute(event.update().where(event.c.id == row["id"]).values(endDate=(row["date"] + timedelta(hours=3)).date()))
    with op.batch_alter_table("Event") as batch:
        batch.alter_column("endDate", existing_type=sa.Date(), nullable=False)

    op.create_table("EventDay", _id(),
        sa.Column("eventId", sa.Integer(), sa.ForeignKey("Event.id"), nullable=False),
        sa.Column("dayOffset", sa.Integer(), nullable=False),
        sa.UniqueConstraint("eventId", "dayOffset", name="uq_event_day_offset"),
        sa.CheckConstraint("dayOffset >= 0", name="event_day_offset_nonnegative"), **OPTIONS)
    op.create_table("TicketCategory", _id(),
        sa.Column("deleted", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("eventId", sa.Integer(), sa.ForeignKey("Event.id"), nullable=False),
        sa.Column("name", sa.String(64), nullable=False), **OPTIONS)
    op.add_column("TicketType", sa.Column("categoryId", sa.Integer(), nullable=True))
    op.add_column("TicketType", sa.Column("daysKey", sa.String(256), nullable=True))
    op.add_column("TicketType", sa.Column("quantity", sa.Integer(), nullable=True))
    op.create_table("TicketTypeDay", _id(),
        sa.Column("typeId", sa.Integer(), sa.ForeignKey("TicketType.id"), nullable=False),
        sa.Column("eventDayId", sa.Integer(), sa.ForeignKey("EventDay.id"), nullable=False),
        sa.UniqueConstraint("typeId", "eventDayId", name="uq_ticket_type_day"), **OPTIONS)
    op.create_table("TicketCheckin", _id(),
        sa.Column("ticketId", sa.Integer(), sa.ForeignKey("Ticket.id"), nullable=False),
        sa.Column("eventDayId", sa.Integer(), sa.ForeignKey("EventDay.id"), nullable=False),
        sa.Column("checkedAt", sa.DateTime(), nullable=True),
        sa.Column("checkedById", sa.Integer(), sa.ForeignKey("User.id"), nullable=True),
        sa.UniqueConstraint("ticketId", "eventDayId", name="uq_ticket_checkin_day"), **OPTIONS)
    with op.batch_alter_table("Ticket") as batch:
        batch.add_column(sa.Column("merchIssuedAt", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("merchIssuedById", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_Ticket_merchIssuedById_User", "User", ["merchIssuedById"], ["id"])
    op.create_table("RequestOperation", _id(),
        sa.Column("actorId", sa.Integer(), sa.ForeignKey("User.id"), nullable=False),
        sa.Column("action", sa.String(32), nullable=False),
        sa.Column("requestId", sa.String(36), nullable=False),
        sa.Column("requestHash", sa.String(64), nullable=False),
        sa.Column("ticketId", sa.Integer(), sa.ForeignKey("Ticket.id"), nullable=False),
        sa.Column("createdAt", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("actorId", "action", "requestId", name="uq_request_operation_key"), **OPTIONS)

    metadata = sa.MetaData()
    day = sa.Table("EventDay", metadata, autoload_with=bind)
    category = sa.Table("TicketCategory", metadata, autoload_with=bind)
    variant = sa.Table("TicketType", metadata, autoload_with=bind)
    link = sa.Table("TicketTypeDay", metadata, autoload_with=bind)
    ticket = sa.Table("Ticket", metadata, autoload_with=bind)
    checkin = sa.Table("TicketCheckin", metadata, autoload_with=bind)
    day_ids = {}
    for event_id in bind.execute(sa.select(event.c.id)).scalars():
        result = bind.execute(day.insert().values(eventId=event_id, dayOffset=0))
        day_ids[event_id] = result.inserted_primary_key[0]
    # Do not filter deleted records or merge equal category names.
    for row in bind.execute(sa.select(variant.c.id, variant.c.eventId, variant.c.name, variant.c.deleted)).mappings():
        result = bind.execute(category.insert().values(eventId=row["eventId"], name=row["name"], deleted=row["deleted"]))
        bind.execute(variant.update().where(variant.c.id == row["id"]).values(categoryId=result.inserted_primary_key[0], daysKey="0"))
        bind.execute(link.insert().values(typeId=row["id"], eventDayId=day_ids[row["eventId"]]))
    for row in bind.execute(sa.select(ticket.c.id, ticket.c.eventId, ticket.c.scannedDate, ticket.c.scannedById).where(ticket.c.scanned.is_(True))).mappings():
        bind.execute(checkin.insert().values(ticketId=row["id"], eventDayId=day_ids[row["eventId"]],
                                            checkedAt=row["scannedDate"], checkedById=row["scannedById"]))
    with op.batch_alter_table("TicketType") as batch:
        batch.alter_column("categoryId", existing_type=sa.Integer(), nullable=False)
        batch.alter_column("daysKey", existing_type=sa.String(256), nullable=False)
        batch.create_foreign_key("fk_TicketType_categoryId_TicketCategory", "TicketCategory", ["categoryId"], ["id"])
        batch.create_unique_constraint("uq_ticket_category_days", ["categoryId", "daysKey"])
        batch.create_check_constraint("ticket_type_quantity_nonnegative", "quantity >= 0")


def downgrade() -> None:
    raise RuntimeError("Multiday history cannot be downgraded safely; restore the pre-upgrade backup before reopening writers")
