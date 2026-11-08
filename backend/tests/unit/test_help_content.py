from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import Mock

from flask import Flask
import pytest

from data import help_content
from data.help_content import HelpRepository


@pytest.fixture
def content(tmp_path: Path) -> Path:
    root = tmp_path / "help"
    article = root / "articles" / "example" / "text.md"
    article.parent.mkdir(parents=True)
    article.write_text("Example instruction.", encoding="utf-8")
    catalog = {
        "sections": [{"id": "start", "title": "Getting started"}],
        "articles": [{
            "id": "example", "title": "Example", "audience": "staff", "section": "start",
            "order": 1, "keywords": [], "requiredPermissions": [],
        }],
    }
    (root / "catalog.json").write_text(json.dumps(catalog), encoding="utf-8")
    release = {
        "id": "upcoming", "noticeGeneration": 1,
        "items": [{
            "id": "entry", "audience": "staff", "requiredPermissions": [],
            "articleId": "example", "important": False, "active": False,
        }],
    }
    (root / "releases").mkdir()
    (root / "releases" / "9999-upcoming.json").write_text(json.dumps(release), encoding="utf-8")
    return root


def test_repository_is_loaded_once_without_requiring_a_flask_context(monkeypatch: pytest.MonkeyPatch):
    constructor = Mock(wraps=HelpRepository)
    monkeypatch.setattr(help_content, "HelpRepository", constructor)
    help_content.repository.cache_clear()
    try:
        repository = help_content.repository()
        assert help_content.repository() is repository
        for name in ("first", "second"):
            with Flask(name).app_context():
                assert help_content.repository() is repository
                assert help_content.current_notice_generation() == repository.generation
        constructor.assert_called_once_with(help_content.HELP_ROOT)
    finally:
        help_content.repository.cache_clear()


@pytest.mark.parametrize("filename", ["catalog.json", "releases/9999-upcoming.json"])
def test_invalid_json_identifies_file_line_and_column(content: Path, filename: str):
    path = content / filename
    path.write_text('{\n  "broken": ]\n}', encoding="utf-8")
    with pytest.raises(ValueError) as caught:
        HelpRepository(content)
    assert str(path) in str(caught.value)
    assert "line 2 column" in str(caught.value)
    assert isinstance(caught.value.__cause__, json.JSONDecodeError)


@pytest.mark.parametrize("kind", ["missing", "invalid-utf8", "unreadable"])
def test_article_read_errors_identify_the_markdown_file(content: Path, monkeypatch: pytest.MonkeyPatch, kind: str):
    path = content / "articles" / "example" / "text.md"
    if kind == "missing":
        path.unlink()
    elif kind == "invalid-utf8":
        path.write_bytes(b"\xff")
    else:
        original = Path.read_text

        def read_text(self: Path, *args, **kwargs):
            if self == path:
                raise PermissionError("Access denied")
            return original(self, *args, **kwargs)

        monkeypatch.setattr(Path, "read_text", read_text)
    with pytest.raises(ValueError) as caught:
        HelpRepository(content)
    message = str(caught.value)
    assert str(path) in message
    assert "articles[0] ('example')" in message
    assert "Cannot read article" in message


def test_missing_catalog_identifies_the_file(content: Path):
    path = content / "catalog.json"
    path.unlink()
    with pytest.raises(ValueError) as caught:
        HelpRepository(content)
    assert str(path) in str(caught.value)
    assert isinstance(caught.value.__cause__, FileNotFoundError)


@pytest.mark.parametrize("field,value,reason", [
    ("id", "Bad_ID", "Invalid article id 'Bad_ID'"),
    ("section", "missing", "Unknown section 'missing'"),
    ("audience", "everyone", "Invalid audience 'everyone'"),
    ("requiredPermissions", "scan_tickets", "Invalid requiredPermissions"),
    ("requiredPermissions", [1], "Invalid requiredPermissions"),
])
def test_catalog_validation_identifies_the_file_and_article(content: Path, field: str, value: object, reason: str):
    path = content / "catalog.json"
    catalog = json.loads(path.read_text(encoding="utf-8"))
    catalog["articles"][0][field] = value
    path.write_text(json.dumps(catalog), encoding="utf-8")
    with pytest.raises(ValueError) as caught:
        HelpRepository(content)
    message = str(caught.value)
    assert str(path) in message
    assert "articles[0]" in message
    assert reason in message


@pytest.mark.parametrize("part,location,reason", [
    ("sections", "sections[1]", "Duplicate help section 'start'"),
    ("articles", "articles[1] ('example')", "Duplicate article id 'example'"),
])
def test_duplicate_catalog_entries_identify_the_record(content: Path, part: str, location: str, reason: str):
    path = content / "catalog.json"
    catalog = json.loads(path.read_text(encoding="utf-8"))
    catalog[part].append(catalog[part][0].copy())
    path.write_text(json.dumps(catalog), encoding="utf-8")
    with pytest.raises(ValueError) as caught:
        HelpRepository(content)
    message = str(caught.value)
    assert str(path) in message
    assert location in message
    assert reason in message


def test_missing_article_field_identifies_the_record_and_field(content: Path):
    path = content / "catalog.json"
    catalog = json.loads(path.read_text(encoding="utf-8"))
    del catalog["articles"][0]["title"]
    path.write_text(json.dumps(catalog), encoding="utf-8")
    with pytest.raises(ValueError) as caught:
        HelpRepository(content)
    message = str(caught.value)
    assert str(path) in message
    assert "articles[0] ('example')" in message
    assert "Missing field 'title'" in message


@pytest.mark.parametrize("field,value,reason", [
    ("id", "Bad_ID", "Invalid release id 'Bad_ID'"),
    ("noticeGeneration", -1, "Invalid noticeGeneration -1"),
    ("noticeGeneration", True, "Invalid noticeGeneration True"),
])
def test_release_validation_identifies_the_file(content: Path, field: str, value: object, reason: str):
    path = content / "releases" / "9999-upcoming.json"
    release = json.loads(path.read_text(encoding="utf-8"))
    release[field] = value
    path.write_text(json.dumps(release), encoding="utf-8")
    with pytest.raises(ValueError) as caught:
        HelpRepository(content)
    assert str(path) in str(caught.value)
    assert reason in str(caught.value)


@pytest.mark.parametrize("field,value,reason", [
    ("id", "Bad_ID", "Invalid release item id 'Bad_ID'"),
    ("audience", "everyone", "Invalid audience 'everyone'"),
    ("requiredPermissions", None, "Invalid requiredPermissions"),
    ("articleId", "missing", "Unknown articleId 'missing'"),
    ("important", True, "Important notices require an organizer audience and generation"),
])
def test_release_item_errors_identify_the_record(content: Path, field: str, value: object, reason: str):
    path = content / "releases" / "9999-upcoming.json"
    release = json.loads(path.read_text(encoding="utf-8"))
    release["items"][0][field] = value
    path.write_text(json.dumps(release), encoding="utf-8")
    with pytest.raises(ValueError) as caught:
        HelpRepository(content)
    message = str(caught.value)
    assert str(path) in message
    assert "items[0]" in message
    assert reason in message


@pytest.mark.parametrize("same_id", [True, False])
def test_duplicate_releases_and_generations_identify_the_second_file(content: Path, same_id: bool):
    release = json.loads((content / "releases" / "9999-upcoming.json").read_text(encoding="utf-8"))
    if not same_id:
        release["id"] = "other"
    path = content / "releases" / "0001-duplicate.json"
    path.write_text(json.dumps(release), encoding="utf-8")
    with pytest.raises(ValueError) as caught:
        HelpRepository(content)
    assert str(path) in str(caught.value)
    assert ("Duplicate release id" if same_id else "Duplicate noticeGeneration") in str(caught.value)


def test_duplicate_release_items_identify_the_second_record(content: Path):
    path = content / "releases" / "9999-upcoming.json"
    release = json.loads(path.read_text(encoding="utf-8"))
    release["items"].append(release["items"][0].copy())
    path.write_text(json.dumps(release), encoding="utf-8")
    with pytest.raises(ValueError) as caught:
        HelpRepository(content)
    message = str(caught.value)
    assert str(path) in message
    assert "items[1] ('entry')" in message
    assert "Duplicate release item id 'entry'" in message


def test_inaccessible_release_link_identifies_the_file_and_item(content: Path):
    path = content / "catalog.json"
    catalog = json.loads(path.read_text(encoding="utf-8"))
    catalog["articles"][0]["audience"] = "organizers"
    path.write_text(json.dumps(catalog), encoding="utf-8")
    with pytest.raises(ValueError) as caught:
        HelpRepository(content)
    message = str(caught.value)
    assert str(content / "releases" / "9999-upcoming.json") in message
    assert "items[0] ('entry')" in message
    assert "less accessible article" in message
