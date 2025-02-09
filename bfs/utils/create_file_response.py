from flask import current_app, send_file


def create_file_response(fpath: str, ftype: str, fname: str):
    max_age = current_app.config["CACHE_MAX_AGE"]
    response = send_file(fpath)
    response.headers.set("Content-Type", ftype)
    response.headers.set("Content-Disposition", "inline", filename=fname)
    response.headers.set("Cache-Control", f"public,max-age={max_age},immutable")
    return response
