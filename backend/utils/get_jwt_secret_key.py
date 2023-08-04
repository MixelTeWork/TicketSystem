import os
import uuid

SECRET_KEY_PATH = "jwt_secret_key.txt"


def get_jwt_secret_key():
    if os.path.exists(SECRET_KEY_PATH):
        with open(SECRET_KEY_PATH, "r") as f:
            return f.read()
    else:
        with open(SECRET_KEY_PATH, "w") as f:
            key = str(uuid.uuid4())
            f.write(key)
            return key
