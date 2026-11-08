"""Store normalized ticket search values; stop old writers before upgrading.

Revision ID: f2c8a16d904e
Revises: d7b91c3e5a20
"""

import unicodedata

import sqlalchemy as sa

from alembic import op

revision = "f2c8a16d904e"
down_revision = "d7b91c3e5a20"
branch_labels = None
depends_on = None


def _normalize(value: str | None) -> str | None:
    # Freeze the 2.14.1 rules so future library changes do not alter this migration.
    if value is None:
        return None
    value = unicodedata.normalize("NFKC", value).casefold()
    value = value.replace("ё", "е")
    value = "".join(char for char in unicodedata.normalize("NFD", value) if not unicodedata.category(char).startswith("M"))
    value = unicodedata.normalize("NFKC", value)
    value = value.translate(_CYRILLIC_TO_LATIN)
    value = "".join(" " if unicodedata.category(char).startswith("P") else char for char in value)
    return " ".join(value.split())


def upgrade() -> None:
    if op.get_context().as_sql:
        raise RuntimeError("Ticket search backfill requires an online database connection")
    op.add_column("Ticket", sa.Column("person_name_search", sa.Text(), nullable=True))
    bind = op.get_bind()
    ticket = sa.table(
        "Ticket",
        sa.column("id", sa.Integer()),
        sa.column("personName", sa.String()),
        sa.column("person_name_search", sa.Text()),
    )
    last_id = None
    while True:
        query = sa.select(ticket.c.id, ticket.c.personName).order_by(ticket.c.id).limit(500)
        if last_id is not None:
            query = query.where(ticket.c.id > last_id)
        rows = bind.execute(query).mappings().all()
        if not rows:
            break
        for row in rows:
            bind.execute(
                ticket.update()
                .where(ticket.c.id == row["id"])
                .values(
                    person_name_search=_normalize(row["personName"]),
                )
            )
        last_id = rows[-1]["id"]


def downgrade() -> None:
    with op.batch_alter_table("Ticket") as batch:
        batch.drop_column("person_name_search")


_CYRILLIC_TO_LATIN = str.maketrans(
    {
        "а": "a",
        "б": "b",
        "в": "v",
        "г": "g",
        "д": "d",
        "е": "e",
        "ё": "yo",
        "ж": "zh",
        "з": "z",
        "и": "i",
        "й": "y",
        "к": "k",
        "л": "l",
        "м": "m",
        "н": "n",
        "о": "o",
        "п": "p",
        "р": "r",
        "с": "s",
        "т": "t",
        "у": "u",
        "ф": "f",
        "х": "h",
        "ц": "ts",
        "ч": "ch",
        "ш": "sh",
        "щ": "sch",
        "ъ": "",
        "ы": "y",
        "ь": "",
        "э": "e",
        "ю": "yu",
        "я": "ya",
    }
)
