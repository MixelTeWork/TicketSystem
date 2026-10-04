"""Protect counters and prices from negative values.

Revision ID: c4a6e8b2d901
Revises: 8eaf6cf33834
"""

from alembic import op
import sqlalchemy as sa


revision = "c4a6e8b2d901"
down_revision = "8eaf6cf33834"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    for table_name, column_name in (
        ("Event", "lastTicketNumber"),
        ("Event", "lastTypeNumber"),
        ("TicketType", "number"),
        ("TicketType", "price"),
        ("Ticket", "price"),
    ):
        table = sa.table(table_name, sa.column(column_name))
        has_negative = bind.execute(
            sa.select(table.c[column_name]).where(table.c[column_name] < 0).limit(1)
        ).first()
        if has_negative is not None:
            raise RuntimeError(f"Cannot add constraints: {table_name}.{column_name} contains negative values")

    with op.batch_alter_table("Event") as batch_op:
        batch_op.create_check_constraint(
            op.f("ck_Event_event_last_ticket_number_nonnegative"), "lastTicketNumber >= 0"
        )
        batch_op.create_check_constraint(
            op.f("ck_Event_event_last_type_number_nonnegative"), "lastTypeNumber >= 0"
        )

    with op.batch_alter_table("TicketType") as batch_op:
        batch_op.create_check_constraint(
            op.f("ck_TicketType_ticket_type_number_nonnegative"), "number >= 0"
        )
        batch_op.create_check_constraint(
            op.f("ck_TicketType_ticket_type_price_nonnegative"), "price >= 0"
        )

    with op.batch_alter_table("Ticket") as batch_op:
        batch_op.create_check_constraint(
            op.f("ck_Ticket_ticket_price_nonnegative"), "price >= 0"
        )


def downgrade() -> None:
    with op.batch_alter_table("Ticket") as batch_op:
        batch_op.drop_constraint(op.f("ck_Ticket_ticket_price_nonnegative"), type_="check")

    with op.batch_alter_table("TicketType") as batch_op:
        batch_op.drop_constraint(op.f("ck_TicketType_ticket_type_price_nonnegative"), type_="check")
        batch_op.drop_constraint(op.f("ck_TicketType_ticket_type_number_nonnegative"), type_="check")

    with op.batch_alter_table("Event") as batch_op:
        batch_op.drop_constraint(op.f("ck_Event_event_last_type_number_nonnegative"), type_="check")
        batch_op.drop_constraint(op.f("ck_Event_event_last_ticket_number_nonnegative"), type_="check")
