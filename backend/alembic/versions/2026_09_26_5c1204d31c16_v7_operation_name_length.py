"""v7: allow current localized operation names

Revision ID: 5c1204d31c16
Revises: 84dd74644c57
Create Date: 2026-09-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5c1204d31c16"
down_revision: Union[str, None] = "84dd74644c57"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("Operation", schema=None) as batch_op:
        batch_op.alter_column(
            "name",
            existing_type=sa.String(length=32),
            type_=sa.String(length=128),
            existing_nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("Operation", schema=None) as batch_op:
        batch_op.alter_column(
            "name",
            existing_type=sa.String(length=128),
            type_=sa.String(length=32),
            existing_nullable=False,
        )
