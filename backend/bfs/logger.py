from datetime import datetime, timedelta
import json
import logging
import logging.handlers
import os

from flask import g, has_request_context, request

import bfs_config


def customTime(*args):
    utc_dt = datetime.utcnow()
    utc_dt += timedelta(hours=3)
    return utc_dt.timetuple()


class InfoFilter(logging.Filter):
    def filter(self, rec):
        return rec.levelno == logging.INFO and rec.name == "root"


class RequestFormatter(logging.Formatter):
    converter = customTime
    max_msg_len = -1
    max_json_len = 1024
    json_indent = None

    def format(self, record):
        if has_request_context():
            url_start = request.url.find(bfs_config.api_url)
            record.url = request.url[url_start:] if url_start >= 0 else request.url
            record.method = request.method
            record.remote_addr = request.remote_addr
            record.req_id = g.get("req_id", "")
            record.uid = g.get("userId", "")
            g_json = g.get("json", None)
            if g_json is not None and g_json[1]:
                record.json = json.dumps(g_json[0], indent=self.json_indent)
            else:
                record.json = "[no json]"
        else:
            record.url = "[url]"
            record.method = "[method]"
            record.remote_addr = "[remote_addr]"
            record.req_id = "[req_id]"
            record.json = "[json]"
            record.uid = "[uid]"

        if self.max_msg_len > 0 and len(record.msg) > self.max_msg_len:
            record.msg = record.msg[:self.max_msg_len] + "..."

        if self.max_json_len > 0 and len(record.json) > self.max_json_len:
            record.json = record.json[:1024] + "..."

        return super().format(record)


class RotatingFileHandler(logging.handlers.RotatingFileHandler):
    def __init__(self, *kargs, **kwargs):
        self.rollover = False
        super().__init__(*kargs, **kwargs)

    def doRollover(self):
        self.rollover = True
        s = self.stream
        self.stream = self._open()
        if s:
            s.close()

    def _open(self):
        filename = self.baseFilename
        i = 0
        n = self.baseFilename.split(".")
        name, ext = (".".join(n[:-1]), n[-1]) if len(n) > 1 else (n[0], "")
        while True:
            i += 1
            filename = self.rotation_filename("%s.%d.%s" % (name, i, ext))
            if not os.path.exists(filename):
                if self.rollover:
                    self.rollover = False
                else:
                    if i - 1 == 0:
                        filename = self.baseFilename
                    else:
                        filename = self.rotation_filename("%s.%d.%s" % (name, i - 1, ext))
                break
        bn = self.baseFilename
        self.baseFilename = filename
        r = super()._open()
        self.baseFilename = bn
        return r


def setLogging():
    logging.basicConfig(
        level=logging.DEBUG,
        # filename="log.log",
        format="[%(asctime)s] %(levelname)s in %(module)s (%(name)s): %(message)s",
        encoding="utf-8"
    )
    logger = logging.getLogger()
    logger.handlers.clear()
    logging.Formatter.converter = customTime

    formatter_error = RequestFormatter("[%(asctime)s] (%(req_id)s by uid=%(uid)-6s) %(method)-6s %(url)-40s | %(levelname)s in %(module)s (%(name)s):\nReq json: %(json)s\n%(message)s\n")  # noqa: E501
    file_handler_error = RotatingFileHandler(
        bfs_config.log_errors_path, mode="a", encoding="utf-8", maxBytes=4 * 1000 * 1000)
    file_handler_error.setFormatter(formatter_error)
    file_handler_error.setLevel(logging.WARNING)
    file_handler_error.encoding = "utf-8"
    logger.addHandler(file_handler_error)

    formatter_info = RequestFormatter("%(req_id)s;%(uid)-6s;%(asctime)s;%(method)s;%(url)s;%(levelname)s;%(module)s;%(message)s")
    file_handler_info = RotatingFileHandler(
        bfs_config.log_path, mode="a", encoding="utf-8", maxBytes=4 * 1000 * 1000)
    file_handler_info.setFormatter(formatter_info)
    file_handler_info.addFilter(InfoFilter())
    file_handler_info.encoding = "utf-8"
    logger.addHandler(file_handler_info)

    logger_requests = get_logger_requests()
    formatter_req = RequestFormatter("%(req_id)s;%(uid)-6s;%(asctime)s;%(method)s;%(url)s;%(levelname)s;%(message)s")
    formatter_req.max_msg_len = 512
    file_handler_req = RotatingFileHandler(
        bfs_config.log_requests_path, mode="a", encoding="utf-8", maxBytes=4 * 1000 * 1000)
    file_handler_req.setFormatter(formatter_req)
    file_handler_req.setLevel(logging.INFO)
    file_handler_req.encoding = "utf-8"
    logger_requests.addHandler(file_handler_req)

    logger_frontend = get_logger_frontend()
    formatter_frontend = RequestFormatter("[%(asctime)s] (uid=%(uid)s):\n%(json)s\n%(message)s\n")
    formatter_frontend.max_json_len = -1
    formatter_frontend.json_indent = 4
    file_handler_frontend = RotatingFileHandler(
        bfs_config.log_frontend_path, mode="a", encoding="utf-8", maxBytes=4 * 1000 * 1000)
    file_handler_frontend.setFormatter(formatter_frontend)
    file_handler_frontend.setLevel(logging.INFO)
    file_handler_frontend.encoding = "utf-8"
    logger_frontend.addHandler(file_handler_frontend)


def get_logger_frontend():
    return logging.getLogger("frontend")


def get_logger_requests():
    return logging.getLogger("requests")


def log_frontend_error():
    get_logger_frontend().info("")
