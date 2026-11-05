# Backend tests

The supported interpreter is Python 3.10.
Use the project environment (`backend/.venv`), with the pinned requirements.

## SQLite suite

From `backend`:

```text
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
.venv/Scripts/python.exe -m pytest -q
```

Coverage:

```text
.venv/Scripts/python.exe -m pytest --cov=blueprints --cov=data --cov=utils --cov-branch --cov-report=term-missing --cov-fail-under=90
```

Tests create their database, keys, logs, images and fonts under pytest's temporary directory. They do not use `storage/db/dev.db`.

`tests/integration/test_relationship_loading.py` checks cold-session query
counts and ORM load events. Plain ticket/day/variant queries must not load
relationships; display serialization must not issue extra SQL or load staff
permissions/design data. Statistics must aggregate in SQL without loading
Ticket/TicketCheckin instances, preserving distinct-ticket and daily counts,
deleted catalog entries and historical checkins after period shortening.
Catalog, user and full event lists are also checked for bounded query counts.


## MySQL suite

The repository root contains `docker-compose.test.yml`. It starts an ephemeral MySQL 8 instance, upgrades an empty database to the latest Alembic revision through the `bafser` CLI, and runs the portable suite plus MySQL locking tests.

Per the workspace infrastructure policy, run this Compose project on the remote Docker VM after syncing the repository files there:

```text
docker compose -f docker-compose.test.yml up --abort-on-container-exit --exit-code-from backend-tests
```

To run pytest against an already available isolated MySQL database, set both variables to the same connection path without a URL scheme:

```text
DBPATH=user:password@host:3306/database
TEST_MYSQL_DBPATH=user:password@host:3306/database
```

Never point these variables at production. The suite deletes test data between cases.

## Historical migration checks before release

CI verifies creation of the current schema from an empty MySQL database and runs
the backend suite with `-m "not release_migration"`. Historical UTC, multiday and
calendar-date migration tests are marked `release_migration` and run separately
before releases that change migrations. The default local/Compose full suite
still includes them.

From `backend`, select them explicitly:

```text
.venv/Scripts/python.exe -m pytest -m release_migration -q
```

For MySQL, also set `TEST_MYSQL_MIGRATION_DBPATH` to a separate database named
`ticketsystem_migration_test`. Create it and grant the test user access using
`tests/mysql-init.sql`; the isolated test Compose project already does this.
These tests drop tables and reconstruct historical schemas, so their database
must differ from `TEST_MYSQL_DBPATH`. They check representative old data and do
not replace rehearsal on a copy of the real database.
