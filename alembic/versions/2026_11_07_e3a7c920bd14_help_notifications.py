"""Persist important help acknowledgements and the new-user notice baseline."""

from alembic import op
import sqlalchemy as sa


revision = "e3a7c920bd14"
down_revision = "c6e2a4b89017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing accounts should see current important notices. ORM-created new
    # accounts receive the current content generation instead of this backfill.
    op.add_column("User", sa.Column("helpNoticeBaseline", sa.Integer(), nullable=False, server_default="0"))
    op.create_table(
        "HelpAcknowledgement",
        sa.Column("id", sa.Integer(), primary_key=True, unique=True, autoincrement=True, nullable=False),
        sa.Column("userId", sa.Integer(), sa.ForeignKey("User.id"), nullable=False),
        sa.Column("noticeId", sa.String(129), nullable=False),
        sa.Column("acknowledgedAt", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("userId", "noticeId", name="uq_help_acknowledgement_user_notice"),
        mysql_charset="utf8mb4", mysql_collate="utf8mb4_unicode_ci",
    )


def downgrade() -> None:
    op.drop_table("HelpAcknowledgement")
    with op.batch_alter_table("User") as batch:
        batch.drop_column("helpNoticeBaseline")
