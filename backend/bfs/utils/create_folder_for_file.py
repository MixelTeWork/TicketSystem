import os


def create_folder_for_file(fpath: str):
    os.makedirs(os.path.dirname(fpath), exist_ok=True)
