"""Convert historical Moscow wall times to UTC.

Revision ID: d7b91c3e5a20
Revises: c4a6e8b2d901
"""

from datetime import datetime, timedelta

from alembic import op
import sqlalchemy as sa


revision = "d7b91c3e5a20"
down_revision = "c4a6e8b2d901"
branch_labels = None
depends_on = None

DATE_COLUMNS = {
    "Event": ("date",),
    "Image": ("creationDate", "deletionDate"),
    "Font": ("creationDate", "deletionDate"),
    "Ticket": ("createdDate", "updatedDate", "scannedDate"),
    "Log": ("date",),
}
BATCH_SIZE = 500


def _shift(value, hours, location, minimum):
    if value is None:
        return None
    try:
        # The old clock incorrectly labelled Moscow wall times as +00:00.
        shifted = value.replace(tzinfo=None) + timedelta(hours=hours)
        if shifted < minimum:
            raise OverflowError
        return shifted
    except OverflowError as error:
        raise RuntimeError(f"Cannot convert {location}: datetime is out of range") from error


def _shift_changes(changes, table_name, hours, location):
    if not isinstance(changes, list):
        return changes
    date_fields = DATE_COLUMNS.get(table_name, ())
    result = []
    for change in changes:
        if not isinstance(change, (list, tuple)) or len(change) != 3 or change[0] not in date_fields:
            result.append(change)
            continue
        values = [change[0]]
        for value in change[1:]:
            if isinstance(value, str):
                try:
                    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                except ValueError:
                    pass  # Preserve non-date historical values rather than discarding audit data.
                else:
                    value = _shift(parsed, hours, f"{location}.{change[0]}", datetime.min).isoformat()
                    if hours < 0:
                        value += "Z"
            values.append(value)
        result.append(values)
    return result


def _batches(bind, table):
    last_id = None
    while True:
        query = sa.select(table).order_by(table.c.id).limit(BATCH_SIZE)
        if last_id is not None:
            query = query.where(table.c.id > last_id)
        rows = bind.execute(query).mappings().all()
        if not rows:
            return
        yield rows
        last_id = rows[-1]["id"]


def _migrate(hours):
    if op.get_context().as_sql:
        raise RuntimeError("Historical UTC conversion requires an online database connection")
    bind = op.get_bind()
    minimum = datetime(1000, 1, 1) if bind.dialect.name == "mysql" else datetime.min
    tables = []
    for name, date_columns in DATE_COLUMNS.items():
        columns = [sa.column("id", sa.Integer()), *(sa.column(column, sa.DateTime()) for column in date_columns)]
        if name == "Log":
            columns.extend((sa.column("tableName", sa.String()), sa.column("changes", sa.JSON())))
        tables.append(sa.table(name, *columns))

    # Alembic wraps this DML-only migration and its revision update in one
    # transaction on both engines. Preflight every value before writing anything.
    for write in (False, True):
        for table in tables:
            statement = table.update().where(table.c.id == sa.bindparam("row_id"))
            for rows in _batches(bind, table):
                updates = []
                for row in rows:
                    location = f"{table.name}[{row['id']}]"
                    values = {
                        column: _shift(row[column], hours, f"{location}.{column}", minimum)
                        for column in DATE_COLUMNS[table.name]
                    }
                    if table.name == "Log":
                        values["changes"] = _shift_changes(row["changes"], row["tableName"], hours, location)
                    updates.append({"row_id": row["id"], **values})
                if write:
                    bind.execute(statement, updates)


def upgrade() -> None:
    _migrate(-3)


def downgrade() -> None:
    _migrate(3)
