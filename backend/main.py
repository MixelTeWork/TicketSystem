from flask import Flask, Response, abort, g, jsonify, make_response, redirect, request, send_from_directory
from flask_jwt_extended import JWTManager
from data import db_session
from blueprints.docs import blueprint as blueprint_docs
from blueprints.authentication import blueprint as blueprint_authentication
from blueprints.api import blueprint as blueprint_api
from blueprints.events import blueprint as blueprint_events
from blueprints.tickets import blueprint as blueprint_tickets
from blueprints.ticket_types import blueprint as blueprint_ticket_types
from blueprints.debug import blueprint as blueprint_debug
from data.user import User
from utils import get_json, get_jwt_secret_key, randstr
from logger import setLogging
import logging
import traceback
import os
import sys
import time

setLogging()
FRONTEND_FOLDER = "build"
app = Flask(__name__, static_folder=None)
app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
app.config["JWT_SECRET_KEY"] = get_jwt_secret_key()
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = False
app.config["JWT_COOKIE_CSRF_PROTECT"] = False

jwt_manager = JWTManager(app)
is_admin_default = False

def main():
    if "dev" in sys.argv:
        if not os.path.exists("db"):
            os.makedirs("db")
    db_session.global_init("db/TicketSystem.db" if "dev" in sys.argv else None)
    if "dev" not in sys.argv:
        check_is_admin_default()
    app.register_blueprint(blueprint_docs)
    app.register_blueprint(blueprint_authentication)
    app.register_blueprint(blueprint_api)
    app.register_blueprint(blueprint_events)
    app.register_blueprint(blueprint_tickets)
    app.register_blueprint(blueprint_ticket_types)
    app.register_blueprint(blueprint_debug)
    if __name__ == "__main__":
        print("Starting")
        app.run(debug=True)


def check_is_admin_default():
    global is_admin_default
    db_sess = db_session.create_session()
    admin: User = db_sess.query(User).filter(User.login == "admin").first()
    if admin is not None:
        is_admin_default = admin.check_password("admin")


@app.before_request
def before_request():
    g.json = get_json(request)
    g.req_id = randstr(4)
    if request.path.startswith("/api"):
        try:
            if (g.json[1]):
                if "password" in g.json[0]:
                    password = g.json[0]["password"]
                    g.json[0]["password"] = "***"
                logging.info("Request;;%(json)s", {"json": g.json[0]})
                if "password" in g.json[0]:
                    g.json[0]["password"] = password
            else:
                logging.info("Request")
        except Exception as x:
            logging.info(f"Request;;logging error {x}")

    if "delay" in sys.argv:
        time.sleep(0.5)
    if is_admin_default:
        check_is_admin_default()
        if is_admin_default:
            # Admin password must be changed
            return jsonify({"msg": "Security error"})


@app.after_request
def after_request(response: Response):
    if request.path.startswith("/api"):
        try:
            logging.info(f"Response;{response.status_code};{response.data}")
        except Exception as x:
            logging.info(f"Response;;logging error {x}")
    return response


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def frontend(path):
    if request.path.startswith("/api"):
        abort(404)
    if path != "" and os.path.exists(FRONTEND_FOLDER + "/" + path):
        res = send_from_directory(FRONTEND_FOLDER, path)
        if "static/" in request.path:
            res.headers.set("Cache-Control", "public,max-age=31536000,immutable")
        else:
            res.headers.set("Cache-Control", "no_cache")
        return res
    else:
        res = send_from_directory(FRONTEND_FOLDER, "index.html")
        res.headers.set("Cache-Control", "no_cache")
        return res


@app.errorhandler(404)
def not_found(error):
    if request.path.startswith("/api"):
        return make_response(jsonify({"msg": "Not found"}), 404)
    return make_response("Страница не найдена", 404)


@app.errorhandler(405)
def method_not_allowed(error):
    return make_response(jsonify({"msg": "Method Not Allowed"}), 405)


@app.errorhandler(415)
def unsupported_media_type(error):
    return make_response(jsonify({"msg": "Unsupported Media Type"}), 415)


@app.errorhandler(500)
@app.errorhandler(Exception)
def internal_server_error(error):
    print(error)
    logging.error(f"{error}\n{traceback.format_exc()}")
    if request.path.startswith("/api/"):
        return make_response(jsonify({"msg": "Internal Server Error"}), 500)
    else:
        return make_response("Произошла ошибка", 500)


@app.errorhandler(401)
def unauthorized(error):
    if request.path.startswith("/api/"):
        return make_response(jsonify({"msg": "Unauthorized"}), 401)
    else:
        return redirect("/login")


@jwt_manager.expired_token_loader
def expired_token_loader():
    return jsonify({"msg": "The JWT has expired"}), 401


@jwt_manager.invalid_token_loader
def invalid_token_loader(error):
    return jsonify({"msg": "Invalid JWT"}), 401


@jwt_manager.unauthorized_loader
def unauthorized_loader(error):
    return jsonify({"msg": "Unauthorized"}), 401


main()
