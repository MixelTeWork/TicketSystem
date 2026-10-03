"""Prepare the database for bafser 2.9.

Revision ID: 731cc3e0b930
Revises: 42af10e7da3b
"""

from alembic import op
import sqlalchemy as sa


revision = "731cc3e0b930"
down_revision = "42af10e7da3b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if not sa.inspect(bind).has_table("db_state"):
        op.create_table(
            "db_state",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("initialized", sa.Boolean(), server_default="0", nullable=False),
        )

    state = sa.table(
        "db_state", sa.column("id", sa.Integer()), sa.column("initialized", sa.Boolean())
    )
    exists = bind.execute(sa.select(state.c.id).where(state.c.id == 1)).first()
    if exists is None:
        users = sa.table("User", sa.column("id", sa.Integer()))
        has_users = bind.execute(sa.select(users.c.id).limit(1)).first() is not None
        bind.execute(state.insert().values(id=1, initialized=has_users))

    with op.batch_alter_table("User") as batch_op:
        batch_op.alter_column(
            "password",
            existing_type=sa.String(128),
            type_=sa.String(256),
            existing_nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("User") as batch_op:
        batch_op.alter_column(
            "password",
            existing_type=sa.String(256),
            type_=sa.String(128),
            existing_nullable=False,
        )
    op.drop_table("db_state")
