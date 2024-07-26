import os
import uuid

JWT_KEY_PATH = "secret_key_jwt.txt"
API_KEY_PATH = "secret_key_api.txt"


def get_jwt_secret_key():
    return get_secret_key(JWT_KEY_PATH)


def get_api_secret_key():
    return get_secret_key(API_KEY_PATH)


def get_secret_key(path):
    if os.path.exists(path):
        with open(path, "r", encoding="utf8") as f:
            return f.read()
    else:
        with open(path, "w", encoding="utf8") as f:
            key = str(uuid.uuid4())
            f.write(key)
            return key
