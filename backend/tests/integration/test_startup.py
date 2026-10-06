import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest


@pytest.mark.parametrize("dev_mode", [False, True])
def test_fresh_startup_seeds_only_development_database(tmp_path, dev_mode):
    backend_dir = Path(__file__).resolve().parents[2]
    isolated_backend = tmp_path / "backend"
    shutil.copytree(
        backend_dir,
        isolated_backend,
        ignore=shutil.ignore_patterns(".venv", "__pycache__", ".pytest_cache", ".coverage", "storage", "build", "tests"),
    )
    script = """
import sys
from pathlib import Path

import bafser_config

dev_mode = sys.argv[1] == "True"
bafser_config.db_mysql = False
bafser_config.db_path = str(Path.cwd() / "production.db")
bafser_config.use_alembic = False

from werkzeug.security import generate_password_hash
import bafser.data.user as user_module

user_module.generate_password_hash = lambda password: generate_password_hash(password, method="pbkdf2:sha256:1")
sys.argv = ["main"] + (["dev"] if dev_mode else [])
import main

from bafser import db_session
from bafser.data.db_state import DBState
from data.event import Event
from data.ticket import Ticket
from data.user import User

assert main.dev_mode == dev_mode
with db_session.create_session() as session:
    assert DBState.is_initialized(session)
    assert session.query(Event).count() == (3 if dev_mode else 0)
    assert session.query(Ticket).count() == (384 if dev_mode else 0)
    assert session.query(User).count() == (9 if dev_mode else 1)
"""
    result = subprocess.run(
        [sys.executable, "-c", script, str(dev_mode)],
        cwd=isolated_backend,
        # Temporary copies must not be counted as separate application sources.
        env={key: value for key, value in os.environ.items() if not key.startswith("COV_CORE_")},
        capture_output=True,
        text=True,
        timeout=60,
    )

    assert result.returncode == 0, result.stdout + result.stderr
