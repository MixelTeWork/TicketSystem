import json
from flask import g, has_request_context, request
from datetime import datetime, timedelta
import logging


def customTime(*args):
    utc_dt = datetime.utcnow()
    utc_dt += timedelta(hours=3)
    return utc_dt.timetuple()


class InfoFilter(logging.Filter):
    def filter(self, rec):
        if "json" in rec.args:
            sjson = json.dumps(rec.args["json"])
            if len(sjson) > 1024:
                sjson = sjson[:1024] + "..."
            rec.args["json"] = sjson
        return rec.levelno == logging.INFO and rec.name == "root"


class RequestFormatter(logging.Formatter):
    converter = customTime
    max_msg_len = -1

    def format(self, record):
        if has_request_context():
            record.url = request.url[request.url.index("/api"):]
            record.method = request.method
            record.remote_addr = request.remote_addr
            record.req_id = g.req_id
            if g.json is not None and g.json[1]:
                record.json = json.dumps(g.json[0])
            else:
                record.json = "[no json]"
        else:
            record.url = "[url]"
            record.method = "[method]"
            record.remote_addr = "[remote_addr]"
            record.req_id = "[req_id]"
            record.json = "[json]"

        if self.max_msg_len > 0 and len(record.msg) > self.max_msg_len:
            record.msg = record.msg[:self.max_msg_len] + "..."

        if len(record.json) > 1024:
            record.json = record.json[:1024] + "..."

        return super().format(record)


def setLogging():
    logging.basicConfig(
        level=logging.DEBUG,
        filename="log.log",
        format="[%(asctime)s] %(levelname)s in %(module)s (%(name)s): %(message)s",
        encoding="utf-8"
    )
    logging.getLogger().handlers.clear()
    logging.Formatter.converter = customTime

    formatter_error = RequestFormatter("[%(asctime)s] (%(req_id)s) %(method)-6s %(url)-40s | %(levelname)s in %(module)s (%(name)s):\nReq json: %(json)s\n%(message)s")
    formatter_info = RequestFormatter("%(req_id)s;%(asctime)s;%(method)s;%(url)s;%(levelname)s;%(message)s")
    formatter_info.max_msg_len = 512

    file_handler_error = logging.FileHandler("log_errors.log", mode="a")
    file_handler_error.setFormatter(formatter_error)
    file_handler_error.setLevel(logging.WARNING)
    file_handler_error.encoding = "utf-8"
    logging.getLogger().addHandler(file_handler_error)

    file_handler_info = logging.FileHandler("log_info.csv", mode="a")
    file_handler_info.setFormatter(formatter_info)
    file_handler_info.addFilter(InfoFilter())
    file_handler_info.encoding = "utf-8"
    logging.getLogger().addHandler(file_handler_info)
