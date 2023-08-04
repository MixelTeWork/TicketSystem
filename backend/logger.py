import logging
from datetime import datetime, timedelta


def customTime(*args):
    utc_dt = datetime.utcnow()
    utc_dt += timedelta(hours=3)
    return utc_dt.timetuple()


class InfoFilter(logging.Filter):
    def filter(self, rec):
        return rec.levelno == logging.INFO and rec.name == "root"


def setLogging():
    logging.basicConfig(
        level=logging.DEBUG,
        filename='TicketSystem.log',
        format='%(asctime)s %(levelname)-8s %(name)s     %(message)s',
        encoding="utf-8"
    )
    logging.Formatter.converter = customTime

    log_formatter_errors = logging.Formatter('%(asctime)s %(levelname)-8s %(name)s     %(message)s')
    log_formatter_info = logging.Formatter('%(asctime)s %(levelname)-8s     %(message)s')

    file_handler_error = logging.FileHandler("TicketSystem-errors.log", mode='a')
    file_handler_error.setFormatter(log_formatter_errors)
    file_handler_error.setLevel(logging.WARNING)
    file_handler_error.encoding = "utf-8"
    logging.getLogger().addHandler(file_handler_error)

    file_handler_info = logging.FileHandler("TicketSystem-info.log", mode='a')
    file_handler_info.setFormatter(log_formatter_info)
    file_handler_info.addFilter(InfoFilter())
    file_handler_info.encoding = "utf-8"
    logging.getLogger().addHandler(file_handler_info)
