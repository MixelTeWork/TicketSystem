"""Expand bafser user, role and audit name columns.

Revision ID: 8eaf6cf33834
Revises: 731cc3e0b930
"""

from alembic import op
import sqlalchemy as sa


revision = "8eaf6cf33834"
down_revision = "731cc3e0b930"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("User") as batch_op:
        batch_op.alter_column(
            "name", existing_type=sa.String(64), type_=sa.String(128), existing_nullable=False
        )

    with op.batch_alter_table("Role") as batch_op:
        batch_op.alter_column(
            "name", existing_type=sa.String(32), type_=sa.String(128), existing_nullable=False
        )

    with op.batch_alter_table("Log") as batch_op:
        batch_op.alter_column(
            "userName", existing_type=sa.String(64), type_=sa.String(128), existing_nullable=False
        )
        batch_op.alter_column(
            "tableName", existing_type=sa.String(16), type_=sa.String(32), existing_nullable=False
        )


def downgrade() -> None:
    with op.batch_alter_table("Log") as batch_op:
        batch_op.alter_column(
            "tableName", existing_type=sa.String(32), type_=sa.String(16), existing_nullable=False
        )
        batch_op.alter_column(
            "userName", existing_type=sa.String(128), type_=sa.String(64), existing_nullable=False
        )

    with op.batch_alter_table("Role") as batch_op:
        batch_op.alter_column(
            "name", existing_type=sa.String(128), type_=sa.String(32), existing_nullable=False
        )

    with op.batch_alter_table("User") as batch_op:
        batch_op.alter_column(
            "name", existing_type=sa.String(128), type_=sa.String(64), existing_nullable=False
        )
