"""Store user-submitted bug reports."""

from alembic import op
import sqlalchemy as sa


revision = "a4f10b8c2e63"
down_revision = "e3a7c920bd14"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "BugReport",
        sa.Column("id", sa.Integer(), primary_key=True, unique=True, autoincrement=True, nullable=False),
        sa.Column("userId", sa.Integer(), sa.ForeignKey("User.id"), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("page", sa.String(2048), nullable=False),
        sa.Column("userAgent", sa.String(512), nullable=False),
        sa.Column("createdAt", sa.DateTime(), nullable=False),
        mysql_charset="utf8mb4", mysql_collate="utf8mb4_unicode_ci",
    )


def downgrade() -> None:
    op.drop_table("BugReport")
