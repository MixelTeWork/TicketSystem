from typing import TypedDict, Union
from sqlalchemy import Column, ForeignKey, Integer

from bafser import Image as ImageBase, get_json_values
from data.user import User


class ImageJson(TypedDict):
    data: str
    name: str
    accessEventId: int


TError = str


class Image(ImageBase):
    accessEventId = Column(Integer, ForeignKey("Event.id"), nullable=True)

    @classmethod
    def new(cls, creator: User, json: ImageJson) -> Union[tuple[None, TError], tuple["Image", None]]:
        return super().new(creator, json)

    @staticmethod
    def _new(creator: User, json: ImageJson, image_kwargs):
        accessEventId, values_error = get_json_values(json, ("accessEventId", None))
        if values_error:
            return None, None, values_error

        img = Image(**image_kwargs, accessEventId=accessEventId)
        changes = [("accessEventId", accessEventId)]
        return img, changes, None
