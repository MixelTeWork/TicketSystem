import sys

# isort: off
import bafser_config
# isort: on

from bafser import AppConfig, create_app

from scripts.init_dev_values import init_dev_values

app, run = create_app(
    __name__,
    AppConfig(
        CACHE_MAX_AGE=31536000,
        MESSAGE_TO_FRONTEND="",
        DEV_MODE=bafser_config.dev_mode,
        DELAY_MODE="delay" in sys.argv,
        JWT_COOKIE_CSRF_PROTECT=True,
        JWT_COOKIE_SAMESITE="Lax",
        JWT_COOKIE_SECURE=not bafser_config.dev_mode,
    )
    .add_data_folder("FONTS_FOLDER", bafser_config.storage_path + "/fonts")
    .add_secret_key_rnd("API_SECRET_KEY", bafser_config.storage_path + "/secret_key_api.txt"),
)

run(__name__ == "__main__", init_dev_values=init_dev_values, port=5001)
