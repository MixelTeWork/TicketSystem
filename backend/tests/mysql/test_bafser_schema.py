"""Check the deployed MySQL schema after the bafser upgrade migrations."""

import pytest
from sqlalchemy import inspect


def test_bafser_2_10_string_column_lengths(db_session):
    bind = db_session.get_bind()
    if bind.dialect.name != "mysql":
        pytest.skip("requires the MySQL migration path")

    schema = inspect(bind)
    for table, expected in {
        "User": {"name": 128},
        "Role": {"name": 128},
        "Operation": {"name": 128},
        "Log": {"userName": 128, "tableName": 32},
    }.items():
        lengths = {
            column["name"]: column["type"].length
            for column in schema.get_columns(table)
            if column["name"] in expected
        }
        for column, length in expected.items():
            assert lengths[column] == length
