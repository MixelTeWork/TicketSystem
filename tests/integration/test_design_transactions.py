from __future__ import annotations

from typing import TYPE_CHECKING

import base64
from datetime import date, datetime
from pathlib import Path

import pytest
from bafser import PublicError
from sqlalchemy.orm import Session

from factories import single_day_variant

if TYPE_CHECKING:
    from data.ticket_type import TicketType
    from data.user import User
    from fixture_types import DesignContext
    from flask import Flask
    from flask.testing import FlaskClient
    from typing import Any


@pytest.fixture
def design(logged_in_admin: FlaskClient, db_session: Session, admin: User, app: Flask):
    from data.event import Event
    from data.img import Image

    event = Event.new(admin, "Design transaction", date(2026, 11, 1))
    Event.get(event.id, for_update=True, db_sess=db_session)
    variant = single_day_variant(admin, event, "Standard", 100, datetime(2026, 11, 1))
    db_session.commit()
    payload = {"name": "Old", "accessEventId": event.id,
               "data": "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\nold").decode()}
    with app.app_context():
        image = Image.new(admin, payload)
    variant.image = image
    variant.pattern = {"width": 10, "height": 20, "objects": []}
    db_session.commit()
    body = {"img": {**payload, "name": "New", "data": "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\nnew").decode()},
            "pattern": {"width": 30, "height": 40, "objects": []}}
    return logged_in_admin, variant.id, image.id, body


@pytest.mark.parametrize("missing_file,deleted_variant", [(False, False), (True, False), (False, True)])
def test_event_restore_recovers_only_live_variant_designs(design: DesignContext, db_session: Session, admin: User, app: Flask, missing_file: bool, deleted_variant: bool):
    from data.event import Event
    from data.img import Image
    from data.ticket_type import TicketType

    _, variant_id, image_id, _ = design
    variant = TicketType.get(variant_id, db_sess=db_session)
    event = Event.get(variant.eventId, for_update=True, db_sess=db_session)
    if deleted_variant:
        assert variant.delete(admin)
    assert event.delete(admin)
    image = Image.get(image_id, includeDeleted=True, db_sess=db_session)
    assert image.deleted
    with app.app_context():
        if missing_file:
            Path(image.get_path()).unlink()
        event = Event.get(event.id, includeDeleted=True, for_update=True, db_sess=db_session)
        assert event.restore(admin, commit=False)
        assert not event.deleted
        assert variant.deleted is deleted_variant
        assert image.deleted is (missing_file or deleted_variant)
        assert (variant.imageId is None) is missing_file
        assert (variant.pattern is None) is missing_file
        db_session.rollback()
        assert event.deleted
        assert image.deleted
        assert variant.imageId == image_id
        assert variant.pattern is not None
        event = Event.get(event.id, includeDeleted=True, for_update=True, db_sess=db_session)
        assert event.restore(admin)
        db_session.expire_all()
        assert not event.deleted
        assert variant.deleted is deleted_variant
        assert image.deleted is (missing_file or deleted_variant)
        assert (variant.imageId is None) is missing_file
        assert (variant.pattern is None) is missing_file


def test_design_replacement_keeps_event_lock_until_the_final_commit(design: DesignContext, db_session: Session, monkeypatch: pytest.MonkeyPatch, app: Flask):
    from data.event import Event
    from data.img import Image
    from data.ticket_type import TicketType

    client, variant_id, old_id, body = design
    original = TicketType.update_design
    observed = []

    def update(self: TicketType, *args: Any, **kwargs: Any):
        observed.append(Event.get(self.eventId, db_sess=self.db_sess).is_for_update)
        return original(self, *args, **kwargs)

    monkeypatch.setattr(TicketType, "update_design", update)
    response = client.post(f"/api/ticket_types/{variant_id}", json=body)
    assert response.status_code == 200, response.get_json()
    assert observed == [True]
    db_session.rollback()
    variant = TicketType.get(variant_id, db_sess=db_session)
    assert variant.pattern == body["pattern"] and variant.imageId != old_id
    assert Image.get(old_id, includeDeleted=True, db_sess=db_session).deleted
    path = Path(app.config["IMAGES_FOLDER"]) / f"{variant.image.id}.{variant.image.type}"
    assert path.read_bytes().endswith(b"new")


@pytest.mark.parametrize("failure", ["update", "commit"])
def test_failed_design_rolls_back_old_design_image_audit_and_new_file(design: DesignContext, db_session: Session, app: Flask, monkeypatch: pytest.MonkeyPatch, failure: str):
    from bafser import Log
    from data.img import Image
    from data.ticket_type import TicketType

    client, variant_id, old_id, body = design
    directory = Path(app.config["IMAGES_FOLDER"])
    before_files = {path.name: path.read_bytes() for path in directory.iterdir()}
    before_logs = db_session.query(Log).count()
    db_session.rollback()
    original = TicketType.update_design

    def update(self: TicketType, *args: Any, **kwargs: Any):
        original(self, *args, **kwargs)
        raise PublicError("Design was rejected", status=409)

    def commit(_session: Session):
        raise RuntimeError("PRIVATE injected commit failure")

    with monkeypatch.context() as patch:
        if failure == "update":
            patch.setattr(TicketType, "update_design", update)
        else:
            patch.setattr(Session, "commit", commit)
        response = client.post(f"/api/ticket_types/{variant_id}", json=body)
    assert response.status_code == (409 if failure == "update" else 500)
    assert response.get_json() == {"msg": "Design was rejected" if failure == "update" else "Internal Server Error"}
    db_session.rollback()
    variant = TicketType.get(variant_id, db_sess=db_session)
    assert variant.pattern == {"width": 10, "height": 20, "objects": []}
    assert variant.imageId == old_id and not variant.image.deleted
    assert db_session.query(Image).count() == 1
    assert db_session.query(Log).count() == before_logs
    assert {path.name: path.read_bytes() for path in directory.iterdir()} == before_files
