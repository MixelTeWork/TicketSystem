import sys
from bafser import AppConfig, create_app
from scripts.init_dev_values import init_dev_values
from dotenv import load_dotenv

load_dotenv()
dev_mode = "dev" in sys.argv

app, run = create_app(__name__, AppConfig(
    CACHE_MAX_AGE=31536000,
    MESSAGE_TO_FRONTEND="",
    DEV_MODE=dev_mode,
    DELAY_MODE="delay" in sys.argv,
    JWT_COOKIE_CSRF_PROTECT=False,
    JWT_COOKIE_SECURE=not dev_mode,
)
    .add_data_folder("FONTS_FOLDER", "storage/fonts")
    .add_secret_key_rnd("API_SECRET_KEY", "storage/secret_key_api.txt")
)

run(__name__ == "__main__", init_dev_values=lambda _db_sess, _config: init_dev_values(True), port=5001)
