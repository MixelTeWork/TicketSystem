from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING

from flask import abort

if TYPE_CHECKING:
    from data.user import User


HELP_ROOT = Path(__file__).resolve().parents[1] / "help"
IDENTIFIER = re.compile(r"[a-z][a-z0-9-]{0,63}\Z")
AUDIENCES = {"organizers", "staff"}
ASSET_TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif"}


def _normalized(value: str) -> str:
    return value.casefold().replace("ё", "е")


def _permitted(user: User, audience: str, permissions: list[str] | tuple[str, ...]) -> bool:
    return user.is_organizer() or audience == "staff" and set(permissions).issubset(user.get_operations())


@dataclass(frozen=True)
class Article:
    id: str
    title: str
    audience: str
    section: str
    order: int
    keywords: tuple[str, ...]
    required_permissions: tuple[str, ...]
    markdown: str

    def summary(self) -> dict:
        return {"id": self.id, "title": self.title, "audience": self.audience, "section": self.section, "order": self.order}

    def _visible_to(self, user: User) -> bool:
        return _permitted(user, self.audience, self.required_permissions)


class HelpRepository:
    """Versioned, trusted content. Every public projection still checks the current user."""

    def __init__(self, root: Path):
        self.root = root.resolve()
        self._load_catalog()
        self._load_releases()

    def _load_catalog(self) -> None:
        path = self.root / "catalog.json"
        location = "catalog"
        try:
            catalog = json.loads(path.read_text(encoding="utf-8"))
            self.sections = catalog["sections"]
            section_ids: set[str] = set()
            for index, section in enumerate(self.sections):
                location = f"sections[{index}]"
                if section["id"] in section_ids:
                    raise ValueError(f"Duplicate help section {section['id']!r}")
                section_ids.add(section["id"])
            location = "catalog"
            self.articles: dict[str, Article] = {}
            for index, entry in enumerate(catalog["articles"]):
                location = f"articles[{index}]"
                article_id = entry["id"]
                location += f" ({article_id!r})"
                if not IDENTIFIER.fullmatch(article_id):
                    raise ValueError(f"Invalid article id {article_id!r}")
                if article_id in self.articles:
                    raise ValueError(f"Duplicate article id {article_id!r}")
                if entry["section"] not in section_ids:
                    raise ValueError(f"Unknown section {entry['section']!r}")
                self._validate_access(entry)
                text_path = (self.root / "articles" / article_id / "text.md").resolve()
                if not text_path.is_relative_to(self.root):
                    raise ValueError(f"Article path escapes content root: {text_path}")
                try:
                    markdown = text_path.read_text(encoding="utf-8")
                except (OSError, UnicodeError) as error:
                    raise ValueError(f"Cannot read article {text_path}: {error}") from error
                self.articles[article_id] = Article(
                    article_id,
                    entry["title"],
                    entry["audience"],
                    entry["section"],
                    entry["order"],
                    tuple(entry["keywords"]),
                    tuple(entry["requiredPermissions"]),
                    markdown,
                )
        except (OSError, ValueError, TypeError, KeyError) as error:
            detail = f"Missing field {error}" if isinstance(error, KeyError) else str(error)
            raise ValueError(f"{path}: {location}: {detail}") from error

    def _load_releases(self) -> None:
        self.releases = []
        release_ids: set[str] = set()
        generations: set[int] = set()
        for path in sorted((self.root / "releases").glob("*.json"), reverse=True):
            location = "release"
            try:
                release = json.loads(path.read_text(encoding="utf-8"))
                release_id = release["id"]
                location += f" {release_id!r}"
                if not IDENTIFIER.fullmatch(release_id):
                    raise ValueError(f"Invalid release id {release_id!r}")
                if release_id in release_ids:
                    raise ValueError(f"Duplicate release id {release_id!r}")
                release_ids.add(release_id)
                generation = release["noticeGeneration"]
                if type(generation) is not int or generation < 0:
                    raise ValueError(f"Invalid noticeGeneration {generation!r}: expected a non-negative integer")
                if generation and generation in generations:
                    raise ValueError(f"Duplicate noticeGeneration {generation}")
                if generation:
                    generations.add(generation)
                item_ids: set[str] = set()
                for index, item in enumerate(release["items"]):
                    location = f"items[{index}]"
                    item_id = item["id"]
                    location += f" ({item_id!r})"
                    self._validate_access(item)
                    if not IDENTIFIER.fullmatch(item_id):
                        raise ValueError(f"Invalid release item id {item_id!r}")
                    if item_id in item_ids:
                        raise ValueError(f"Duplicate release item id {item_id!r}")
                    item_ids.add(item_id)
                    if item["articleId"] is not None:
                        article = self.articles.get(item["articleId"])
                        if article is None:
                            raise ValueError(f"Unknown articleId {item['articleId']!r}")
                        if item["audience"] == "staff" and (
                            article.audience != "staff" or not set(article.required_permissions).issubset(item["requiredPermissions"])
                        ):
                            raise ValueError(f"Release links to a less accessible article {article.id!r}")
                    if item["important"] and (item["audience"] != "organizers" or not generation):
                        raise ValueError("Important notices require an organizer audience and generation")
                self.releases.append(release)
            except (OSError, ValueError, TypeError, KeyError) as error:
                detail = f"Missing field {error}" if isinstance(error, KeyError) else str(error)
                raise ValueError(f"{path}: {location}: {detail}") from error
        self.generation = max(generations, default=0)

    @staticmethod
    def _validate_access(entry: dict) -> None:
        if entry["audience"] not in AUDIENCES:
            raise ValueError(f"Invalid audience {entry['audience']!r}")
        if not isinstance(entry["requiredPermissions"], list) or any(not isinstance(value, str) for value in entry["requiredPermissions"]):
            raise ValueError("Invalid requiredPermissions: expected a list of strings")

    def article(self, article_id: str, user: User) -> Article:
        article = self.articles.get(article_id)
        if article is None or not article._visible_to(user):
            abort(404)
        return article

    def catalog(self, user: User) -> dict:
        articles = [article.summary() for article in sorted(self.articles.values(), key=lambda value: value.order) if article._visible_to(user)]
        used = {article["section"] for article in articles}
        return {
            "sections": [section for section in self.sections if section["id"] in used],
            "articles": articles,
            "audiences": ["organizers", "staff"] if user.is_organizer() else ["staff"],
        }

    def asset(self, article_id: str, filename: str, user: User) -> tuple[Path, str]:
        self.article(article_id, user)
        # Only local raster illustrations can be served, with the article's access.
        if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}", filename) or ".." in filename:
            abort(404)
        folder = (self.root / "articles" / article_id / "assets").resolve()
        path = (folder / filename).resolve()
        mimetype = ASSET_TYPES.get(path.suffix.lower())
        if not folder.is_relative_to(self.root) or not path.is_relative_to(folder) or not path.is_file() or mimetype is None:
            abort(404)
        return path, mimetype

    def release_list(self, user: User) -> list[dict]:
        result = []
        for release in self.releases:
            items = [self._release_item(item) for item in release["items"] if _permitted(user, item["audience"], item["requiredPermissions"])]
            if items:
                result.append({key: value for key, value in release.items() if key not in {"items", "noticeGeneration"}} | {"items": items})
        return result

    @staticmethod
    def _release_item(item: dict) -> dict:
        return {key: item[key] for key in ("id", "audience", "title", "text", "articleId")}

    def notices(self, user: User) -> list[dict]:
        if not user.is_organizer():
            return []
        return [
            self._release_item(item) | {"id": f"{release['id']}:{item['id']}", "releaseId": release["id"]}
            for release in self.releases
            if release["noticeGeneration"] > user.helpNoticeBaseline
            for item in release["items"]
            if item["important"] and item["active"]
        ]

    def search(self, query: str, user: User) -> dict:
        tokens = list(dict.fromkeys(re.findall(r"\w+", _normalized(query))))
        if not tokens:
            return {"items": [], "total": 0}
        found = []
        for article in self.articles.values():
            if not article._visible_to(user):
                continue
            # Strip presentation syntax for readable excerpts, never return HTML.
            text = re.sub(r"!\[[^\]]*\]\([^)]*\)|\[!(?:NOTE|WARNING)\]", "", article.markdown)
            text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
            text = re.sub(r"[`#>*_|]", "", text)
            text = " ".join(text.split())
            title, keywords, body = _normalized(article.title), _normalized(" ".join(article.keywords)), _normalized(text)
            if not all(token in title or token in keywords or token in body for token in tokens):
                continue
            score = sum(100 if token in title else 60 if token in keywords else 10 for token in tokens)
            positions = [position for token in tokens if (position := body.find(token)) >= 0]
            start = max(0, min(positions, default=0) - 45)
            snippet = ("…" if start else "") + text[start : start + 190] + ("…" if len(text) > start + 190 else "")
            found.append((score, article.order, article.summary() | {"snippet": snippet}))
        found.sort(key=lambda entry: (-entry[0], entry[1]))
        return {"items": [item for _, _, item in found[:30]], "total": len(found)}


@lru_cache(maxsize=1)
def repository() -> HelpRepository:
    return HelpRepository(HELP_ROOT)


def current_notice_generation() -> int:
    return repository().generation
