from flask import has_request_context, request
from datetime import datetime, timedelta
import logging


def customTime(*args):
    utc_dt = datetime.utcnow()
    utc_dt += timedelta(hours=3)
    return utc_dt.timetuple()


class InfoFilter(logging.Filter):
    def filter(self, rec):
        return rec.levelno == logging.INFO and rec.name == "root"


class RequestFormatter(logging.Formatter):
    def format(self, record):
        if has_request_context():
            record.url = request.url
            record.method = request.method
            record.remote_addr = request.remote_addr
        else:
            record.url = "[url]"
            record.method = "[mtd]"
            record.remote_addr = "[rad]"

        return super().format(record)


def setLogging():
    logging.basicConfig(
        level=logging.DEBUG,
        filename="log.log",
        format="[%(asctime)s] %(levelname)s in %(module)s (%(name)s): %(message)s",
        encoding="utf-8"
    )
    logging.Formatter.converter = customTime

    formatter_error = RequestFormatter("[%(asctime)s] %(remote_addr)-20s %(method)-6s %(url)-40s | %(levelname)s in %(module)s (%(name)s):\n%(message)s")
    formatter_info = RequestFormatter("[%(asctime)s] %(remote_addr)-20s %(method)-6s %(url)-40s | %(levelname)s | %(message)s")

    file_handler_error = logging.FileHandler("log_errors.log", mode="a")
    file_handler_error.setFormatter(formatter_error)
    file_handler_error.setLevel(logging.WARNING)
    file_handler_error.encoding = "utf-8"
    logging.getLogger().addHandler(file_handler_error)

    file_handler_info = logging.FileHandler("log_info.log", mode="a")
    file_handler_info.setFormatter(formatter_info)
    file_handler_info.addFilter(InfoFilter())
    file_handler_info.encoding = "utf-8"
    logging.getLogger().addHandler(file_handler_info)
