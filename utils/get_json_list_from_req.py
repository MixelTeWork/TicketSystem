from typing import Union
from flask import g, Response

from utils import response_msg

responseCode = int
errorRes = tuple[Response, responseCode]


def get_json_list_from_req() -> tuple[list, Union[errorRes, None]]:
    values, is_json = g.json
    if not is_json:
        return [], (response_msg("body is not json"), 415)

    if not isinstance(values, list):
        return [], (response_msg("body is not json list"), 400)

    return values, None
