from __future__ import annotations

import os
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest


STARTUP_SCRIPT = """
import os
import sys
from pathlib import Path

dev_mode = sys.argv[1] == "True"
action = sys.argv[2]
sys.argv = ["main"] + (["dev"] if dev_mode else []) + (["--setup"] if action == "setup" else [])

import bafser_config

storage = Path(os.environ["TICKETSYSTEM_STORAGE_DIR"])
assert bafser_config.STORAGE_DIR == storage
assert bafser_config.dev_mode is dev_mode
assert bafser_config.allow_unsupported_for_update_clause is None
# This lifecycle check uses only its own SQLite file. MySQL locking has separate tests.
bafser_config.db_mysql = False
bafser_config.db_path = str(storage / "production.db")
bafser_config.use_alembic = False
bafser_config.allow_unsupported_for_update_clause = True

from werkzeug.security import generate_password_hash
import bafser.data.user as user_module

user_module.generate_password_hash = lambda password: generate_password_hash(password, method="pbkdf2:sha256:1")

if action == "runtime":
    from sqlalchemy import event
    from sqlalchemy.engine import Engine
    from bafser import Role
    from bafser.data.db_state import DBState

    @event.listens_for(Engine, "before_cursor_execute")
    def guard_runtime_sql(connection, cursor, statement, parameters, context, executemany):
        command = statement.lstrip().split(None, 1)[0].upper()
        assert command in {"SELECT", "PRAGMA"}, "Runtime import attempted schema/data preparation: " + command

    def forbid_setup(*args, **kwargs):
        raise AssertionError("Runtime import invoked database preparation")

    Role.update_roles_permissions = staticmethod(forbid_setup)
    DBState.is_initialized = staticmethod(forbid_setup)

import main

from bafser import db_session
from bafser.data.db_state import DBState
from data.event import Event
from data.ticket import Ticket
from data.user import User

config = main.app.extensions["bafser_config"]
assert main.bafser_config.dev_mode is dev_mode
assert config.AUTO_SETUP is dev_mode
assert config.MULTIPROCESS_LOGGING is not dev_mode
assert main.app.config["JWT_COOKIE_CSRF_PROTECT"] is True
assert main.app.config["JWT_COOKIE_SAMESITE"] == "Lax"
assert main.app.config["JWT_COOKIE_SECURE"] is not dev_mode
assert bafser_config.allow_unsupported_for_update_clause is True
assert Path(config.FRONTEND_FOLDER) == bafser_config.PROJECT_DIR / "build"
assert Path(bafser_config.migrations_folder) == bafser_config.PROJECT_DIR / "alembic"
assert main.app.config["JWT_SECRET_KEY"] == (storage / "secret_key_jwt.txt").read_text(encoding="utf-8")
assert main.app.config["API_SECRET_KEY"] == (storage / "secret_key_api.txt").read_text(encoding="utf-8")
with db_session.create_session() as session:
    if action != "runtime":
        assert DBState.is_initialized(session)
    else:
        assert session.query(DBState).count() >= 1
    assert session.query(Event).count() == (4 if dev_mode else 0)
    assert session.query(Ticket).count() == (512 if dev_mode else 0)
    assert session.query(User).count() == (9 if dev_mode else 1)
"""


@pytest.fixture
def isolated_backend(tmp_path: Path) -> Path:
    backend_dir = Path(__file__).resolve().parents[2]
    isolated = tmp_path / "backend"
    shutil.copytree(
        backend_dir,
        isolated,
        ignore=shutil.ignore_patterns(
            ".venv", "__pycache__", ".pytest_cache", ".coverage", "storage", "build", "tests",
            ".env", ".env.*", "secret_key*.txt", "*.db", "*.sqlite", "*.sqlite3",
        ),
    )
    return isolated


def run_isolated(
    backend: Path,
    storage_value: str | None,
    script: str,
    *args: str,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    # Do not inherit database paths, application secrets or coverage injection into the copy.
    system_keys = {"PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "TMPDIR", "HOME", "LANG", "LC_ALL", "PYTHONUTF8"}
    environment = {key: value for key, value in os.environ.items() if key.upper() in system_keys}
    environment["PYTHONPATH"] = str(backend)
    if storage_value is not None:
        environment["TICKETSYSTEM_STORAGE_DIR"] = storage_value
    return subprocess.run(
        [sys.executable, "-c", script, *args],
        cwd=cwd or backend,
        env=environment,
        capture_output=True,
        text=True,
        timeout=60,
    )


def assert_started(result: subprocess.CompletedProcess[str]) -> None:
    assert result.returncode == 0, result.stdout + result.stderr


def database_counts(path: Path) -> dict[str, int]:
    with sqlite3.connect(path) as connection:
        tables = connection.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").fetchall()
        return {name: connection.execute('SELECT COUNT(*) FROM "' + name.replace('"', '""') + '"').fetchone()[0] for (name,) in tables}


@pytest.mark.parametrize("dev_mode", [False, True])
def test_fresh_setup_seeds_only_development_database(isolated_backend: Path, tmp_path: Path, dev_mode: bool):
    storage = tmp_path / "persistent-storage"
    action = "auto" if dev_mode else "setup"

    result = run_isolated(isolated_backend, str(storage), STARTUP_SCRIPT, str(dev_mode), action)

    assert_started(result)
    assert (storage / "secret_key_jwt.txt").is_file()
    assert (storage / "secret_key_api.txt").is_file()
    assert (storage / "fonts").is_dir()
    assert (storage / "images").is_dir()


def test_production_setup_is_idempotent_and_runtime_import_has_no_preparation(isolated_backend: Path, tmp_path: Path):
    storage = tmp_path / "persistent-storage"
    assert_started(run_isolated(isolated_backend, str(storage), STARTUP_SCRIPT, "False", "setup"))
    original_keys = {name: (storage / name).read_bytes() for name in ("secret_key_jwt.txt", "secret_key_api.txt")}
    original_counts = database_counts(storage / "production.db")

    assert_started(run_isolated(isolated_backend, str(storage), STARTUP_SCRIPT, "False", "setup"))
    assert database_counts(storage / "production.db") == original_counts

    other_cwd = tmp_path / "other-cwd"
    other_cwd.mkdir()
    (other_cwd / ".env").write_text("TICKETSYSTEM_STORAGE_DIR=wrong-storage\nDBPATH=wrong-database\n", encoding="utf-8")
    result = run_isolated(isolated_backend, str(storage), STARTUP_SCRIPT, "False", "runtime", cwd=other_cwd)

    assert_started(result)
    assert "Setup database" not in result.stdout
    assert "initialize database" not in result.stdout
    assert database_counts(storage / "production.db") == original_counts
    for name, value in original_keys.items():
        assert (storage / name).read_bytes() == value


@pytest.mark.parametrize("value,message", [
    (None, "Set TICKETSYSTEM_STORAGE_DIR"),
    ("", "TICKETSYSTEM_STORAGE_DIR must not be empty"),
    ("relative/storage", "TICKETSYSTEM_STORAGE_DIR must be an absolute path"),
])
def test_production_config_rejects_invalid_storage(isolated_backend: Path, value: str | None, message: str):
    result = run_isolated(isolated_backend, value, "import bafser_config")

    assert result.returncode != 0
    assert message in result.stderr


def test_production_config_requires_existing_storage_outside_setup(isolated_backend: Path, tmp_path: Path):
    storage = tmp_path / "not-prepared"
    result = run_isolated(isolated_backend, str(storage), "import bafser_config")

    assert result.returncode != 0
    assert "persistent storage directory is missing" in result.stderr
    assert not storage.exists()


@pytest.mark.parametrize("key_name", ["secret_key_jwt.txt", "secret_key_api.txt"])
@pytest.mark.parametrize("empty", [False, True])
def test_runtime_rejects_missing_or_empty_key_without_replacement(
    isolated_backend: Path, tmp_path: Path, key_name: str, empty: bool
):
    storage = tmp_path / "persistent-storage"
    assert_started(run_isolated(isolated_backend, str(storage), STARTUP_SCRIPT, "False", "setup"))
    key = storage / key_name
    if empty:
        key.write_bytes(b"")
    else:
        key.unlink()

    result = run_isolated(isolated_backend, str(storage), STARTUP_SCRIPT, "False", "runtime")

    assert result.returncode != 0
    assert ("Secret key file must not be empty" if empty else "FileNotFoundError") in result.stderr
    if empty:
        assert key.read_bytes() == b""
    else:
        assert not key.exists()


def test_development_default_paths_ignore_foreign_cwd_environment(isolated_backend: Path, tmp_path: Path):
    other_cwd = tmp_path / "other-cwd"
    other_cwd.mkdir()
    (other_cwd / ".env").write_text("TICKETSYSTEM_STORAGE_DIR=wrong-storage\nFOREIGN_CWD_CANARY=unexpected\n", encoding="utf-8")
    script = """
import os
import sys
sys.argv = ["main", "dev"]
import bafser_config
assert bafser_config.STORAGE_DIR == bafser_config.PROJECT_DIR / "storage"
assert bafser_config.frontend_folder == str(bafser_config.PROJECT_DIR / "build")
assert os.environ.get("FOREIGN_CWD_CANARY") is None
"""

    result = run_isolated(isolated_backend, None, script, cwd=other_cwd)

    assert_started(result)
