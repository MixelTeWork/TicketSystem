import json
import logging
import traceback
import os
import sys
import time
from flask import Flask, Response, abort, g, jsonify, make_response, redirect, request, send_from_directory
from flask_jwt_extended import JWTManager
from blueprints.register_blueprints import register_blueprints
from data import db_session
from data.user import User
from utils import get_json, get_api_secret_key, get_jwt_secret_key, randstr
from logger import setLogging


setLogging()
FRONTEND_FOLDER = "build"
app = Flask(__name__, static_folder=None)
app.config["IMAGES_FOLDER"] = "images"
app.config["FONTS_FOLDER"] = "fonts"
app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
app.config["JWT_SECRET_KEY"] = get_jwt_secret_key()
app.config["API_SECRET_KEY"] = get_api_secret_key()
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = False
app.config["JWT_COOKIE_CSRF_PROTECT"] = False
MESSAGE_TO_FRONTEND = ""

jwt_manager = JWTManager(app)
is_admin_default = False


def main():
    if not os.path.exists(app.config["IMAGES_FOLDER"]):
        os.makedirs(app.config["IMAGES_FOLDER"])

    if not os.path.exists(app.config["FONTS_FOLDER"]):
        os.makedirs(app.config["FONTS_FOLDER"])

    if "dev" in sys.argv:
        if not os.path.exists("db"):
            os.makedirs("db")
            from scripts.init_values import init_values
            init_values(True)

    db_session.global_init("dev" in sys.argv)

    if "dev" not in sys.argv:
        check_is_admin_default()

    register_blueprints(app)
    if __name__ == "__main__":
        print("Starting")
        if "delay" in sys.argv:
            print("Delay for requests is enabled")
        app.run(debug=True, port=5001)


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
            if g.json[1]:
                data = ""
                if "password" in g.json[0]:
                    password = g.json[0]["password"]
                    g.json[0]["password"] = "***"
                    data = json.dumps(g.json[0])[:512]
                    g.json[0]["password"] = password
                logging.info("Request;%(data)s", {"data": data})
            else:
                logging.info("Request")
        except Exception as x:
            logging.error("Request logging error: %s", x)

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
            if response.content_type == "application/json":
                logging.info("Response;%s;%s", response.status_code, str(response.data)[:512])
            else:
                logging.info("Response;%s", response.status_code)
        except Exception as x:
            logging.error("Request logging error: %s", x)
    response.set_cookie("MESSAGE_TO_FRONTEND", MESSAGE_TO_FRONTEND)
    return response


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def frontend(path):
    if request.path.startswith("/api"):
        abort(404)
    if path != "" and os.path.exists(FRONTEND_FOLDER + "/" + path):
        res = send_from_directory(FRONTEND_FOLDER, path)
        if request.path.startswith("/static") or request.path.startswith("/fonts"):
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


@app.errorhandler(403)
def no_permission(error):
    return make_response(jsonify({"msg": "No permission"}), 403)


@app.errorhandler(500)
@app.errorhandler(Exception)
def internal_server_error(error):
    print(error)
    logging.error("%s\n%s", error, traceback.format_exc())
    if request.path.startswith("/api/"):
        return make_response(jsonify({"msg": "Internal Server Error"}), 500)
    return make_response("Произошла ошибка", 500)


@app.errorhandler(401)
def unauthorized(error):
    if request.path.startswith("/api/"):
        return make_response(jsonify({"msg": "Unauthorized"}), 401)
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
