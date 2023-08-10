import string
from random import choices

letters = string.ascii_uppercase + string.digits


def randstr(N):
    return ''.join(choices(letters, k=N))
