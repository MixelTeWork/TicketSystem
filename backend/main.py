import sys
from bfs import AppConfig, create_app
from scripts.init_dev_values import init_dev_values


app, run = create_app(__name__, AppConfig(
    CACHE_MAX_AGE=31536000,
    MESSAGE_TO_FRONTEND="",
    DEV_MODE="dev" in sys.argv,
    DELAY_MODE="delay" in sys.argv,
)
    .add_data_folder("FONTS_FOLDER", "fonts")
    .add_secret_key_rnd("API_SECRET_KEY", "secret_key_api.txt")
)

run(__name__ == "__main__", lambda: init_dev_values(True), port=5001)
