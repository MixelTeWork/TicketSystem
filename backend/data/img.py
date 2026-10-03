from typing import TypedDict, Union

from bafser import Image as ImageBase
from bafser import get_json_values
from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from data.user import User


class ImageJson(TypedDict):
    data: str
    name: str
    accessEventId: int


TError = str


class Image(ImageBase):
    accessEventId: Mapped[int | None] = mapped_column(Integer, ForeignKey("Event.id"), nullable=True, default=None)

    @classmethod
    def new(cls, creator: User, json: ImageJson) -> tuple[None, TError] | tuple["Image", None]:
        return super().new(creator, json)

    @staticmethod
    def _new(creator: User, json: ImageJson, image_kwargs):
        accessEventId, values_error = get_json_values(json, ("accessEventId", int | None, None))
        if values_error:
            return None, values_error

        img = Image(**image_kwargs, accessEventId=accessEventId)
        return img, None
