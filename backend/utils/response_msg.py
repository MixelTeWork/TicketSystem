from flask import jsonify


def response_msg(msg: str):
    return jsonify({"msg": msg})
