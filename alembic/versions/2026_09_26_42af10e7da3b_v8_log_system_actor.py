"""v8: allow audit entries created by the system bootstrap actor

Revision ID: 42af10e7da3b
Revises: 5c1204d31c16
Create Date: 2026-09-26
"""
from typing import Sequence, Union

from alembic import op


revision: str = "42af10e7da3b"
down_revision: Union[str, None] = "5c1204d31c16"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("Log", schema=None) as batch_op:
        batch_op.drop_constraint(
            op.f("fk_Log_userId_User"), type_="foreignkey"
        )


def downgrade() -> None:
    with op.batch_alter_table("Log", schema=None) as batch_op:
        batch_op.create_foreign_key(
            op.f("fk_Log_userId_User"), "User", ["userId"], ["id"]
        )
