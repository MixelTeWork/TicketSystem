# Backend tests

The supported interpreter is Python 3.9.5.

## SQLite suite

From `backend`:

```text
py -3.9 -m pip install -r requirements-dev.txt
py -3.9 -m pytest -q
```

Coverage:

```text
py -3.9 -m pytest --cov=blueprints --cov=data --cov=utils --cov-branch --cov-report=term-missing --cov-fail-under=90
```

Tests create their database, keys, logs, images and fonts under pytest's temporary directory. They do not use `storage/db/dev.db`.

## MySQL suite

The repository root contains `docker-compose.test.yml`. It starts an ephemeral MySQL 8 instance, upgrades an empty database through every Alembic revision, verifies the current revision, and runs the portable suite plus MySQL locking tests.

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
