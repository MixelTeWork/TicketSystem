from __future__ import annotations

from typing import TYPE_CHECKING

from io import BytesIO
from pathlib import Path

import pytest
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from flask import Flask
    from flask.testing import FlaskClient
    from sqlalchemy.engine.interfaces import DBAPIConnection
    from typing import Any


def upload(client: FlaskClient, name: str, content: bytes):
    return client.post("/api/fonts", data={
        "name": name,
        "type": "woff2",
        "font": (BytesIO(content), "font.woff2"),
    }, content_type="multipart/form-data")


@pytest.mark.parametrize("probe_unavailable", [False, True])
def test_font_file_survives_a_commit_that_succeeded_before_driver_error(logged_in_admin: FlaskClient, db_session: Session, app: Flask, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture, probe_unavailable: bool):
    from bafser import Log

    from data.font import Font

    engine = db_session.get_bind()
    original = engine.dialect.do_commit
    original_connect = engine.connect
    committed = []
    probes = []

    def commit_then_raise(connection: DBAPIConnection):
        original(connection)
        if not committed:
            committed.append(True)
            raise OSError("PRIVATE lost commit acknowledgement")

    def connect(*args: Any, **kwargs: Any):
        if committed:
            probes.append(True)
            raise OSError("PRIVATE outcome probe unavailable")
        return original_connect(*args, **kwargs)

    content = b"wOF2 committed font"
    with monkeypatch.context() as patch:
        patch.setattr(engine.dialect, "do_commit", commit_then_raise)
        if probe_unavailable:
            patch.setattr(engine, "connect", connect)
        response = upload(logged_in_admin, "Committed font", content)
    assert committed == [True]
    assert response.status_code == 500
    assert response.get_json() == {"msg": "Internal Server Error"}
    db_session.rollback()
    font = db_session.query(Font).filter_by(name="Committed font").one()
    path = Path(app.config["FONTS_FOLDER"]) / f"{font.id}.woff2"
    assert path.read_bytes() == content
    if probe_unavailable:
        assert probes
        assert any("retaining file" in record.message and str(path) in record.message for record in caplog.records)
    assert db_session.query(Log).filter_by(tableName="Font", recordId=font.id, actionCode="added").count() == 1
    repeated = upload(logged_in_admin, "Committed font", b"replacement must not overwrite the committed font")
    assert repeated.status_code == 400
    assert repeated.get_json() == {"msg": "Шрифт с таким названием уже существует", "code": "font_exists"}
    assert path.read_bytes() == content


def test_font_file_is_removed_when_commit_definitely_did_not_happen(logged_in_admin: FlaskClient, db_session: Session, app: Flask, monkeypatch: pytest.MonkeyPatch):
    from bafser import Log

    from data.font import Font

    directory = Path(app.config["FONTS_FOLDER"])
    before = {path.name: path.read_bytes() for path in directory.iterdir()}

    def fail(_session: Session):
        raise OSError("PRIVATE commit failed before the database")

    with monkeypatch.context() as patch:
        patch.setattr(Session, "commit", fail)
        response = upload(logged_in_admin, "Rejected font", b"wOF2 rejected font")
    assert response.status_code == 500
    assert response.get_json() == {"msg": "Internal Server Error"}
    db_session.rollback()
    assert db_session.query(Font).count() == 0
    assert db_session.query(Log).filter_by(tableName="Font").count() == 0
    assert {path.name: path.read_bytes() for path in directory.iterdir()} == before
