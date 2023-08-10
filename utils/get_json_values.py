from typing import Any, Union

field_name = str
default_value = Any
values_tuple = list[Any]
error = str


def get_json_values(d: dict, *field_names: Union[field_name, tuple[field_name, default_value]]) -> tuple[values_tuple, error]:
    r = []
    for field in field_names:
        if isinstance(field, tuple):
            field_name, default_value = field
            have_default = True
        else:
            field_name = field
            have_default = False

        if field_name in d:
            r.append(d[field_name])
        elif have_default:
            r.append(default_value)
        else:
            return list(map(lambda x: None, field_names)), f"{field_name} is undefined"
    return r, None
