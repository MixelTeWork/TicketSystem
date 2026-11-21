"""Allow explicit system audit authors without rewriting historical users."""

from alembic import op
import sqlalchemy as sa


revision = "b9d20f7a6c31"
down_revision = "a4f10b8c2e63"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("Log") as batch:
        batch.alter_column("userId", existing_type=sa.Integer(), existing_nullable=False, nullable=True)


def downgrade() -> None:
    # Run a NOT NULL downgrade only after stopping writers. A system author has
    # no corresponding User; mapping it to a historical ID would falsify audit.
    log = sa.table("Log", sa.column("userId", sa.Integer()))
    system_row = op.get_bind().execute(sa.select(log.c.userId).where(log.c.userId.is_(None)).limit(1)).first()
    if system_row is not None:
        raise RuntimeError("Cannot downgrade Log.userId to NOT NULL while system audit records have NULL authors")
    with op.batch_alter_table("Log") as batch:
        batch.alter_column("userId", existing_type=sa.Integer(), existing_nullable=True, nullable=False)
