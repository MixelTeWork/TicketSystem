from bafser import Image as ImageBase
from bafser import get_json_values
from bafser.data.image import ImageJson as BaseImageJson
from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column
from typing_extensions import NotRequired

from data.user import User


class ImageJson(BaseImageJson):
    accessEventId: NotRequired[int | None]


class Image(ImageBase):
    accessEventId: Mapped[int | None] = mapped_column(Integer, ForeignKey("Event.id"), nullable=True, default=None)

    @classmethod
    def _new(cls, creator: User, json: ImageJson, image_kwargs):
        accessEventId, values_error = get_json_values(json, ("accessEventId", int | None, None))
        if values_error:
            return None, values_error

        img = cls(**image_kwargs, accessEventId=accessEventId)
        return img, None
