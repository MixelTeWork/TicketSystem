from bafser import Image as ImageBase
from bafser import ImageError, get_json_values
from bafser.data.image import ImageJson as BaseImageJson
from bafser.data.image import ImageKwargs
from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column
from typing_extensions import NotRequired

from data._tables import Tables
from data.user import User


class ImageJson(BaseImageJson):
    accessEventId: NotRequired[int | None]


class Image(ImageBase):
    """A stored image optionally restricted to an event."""

    accessEventId: Mapped[int | None] = mapped_column(Integer, ForeignKey(f"{Tables.Event}.id"), nullable=True, default=None)

    @classmethod
    def _new(cls, creator: User, json: ImageJson, image_kwargs: ImageKwargs):
        accessEventId, values_error = get_json_values(json, ("accessEventId", int | None, None))
        if values_error:
            raise ImageError(values_error)

        img = cls(**image_kwargs, accessEventId=accessEventId)
        return img
