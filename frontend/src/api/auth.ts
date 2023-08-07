import fetchPost from "../utils/fetchPost"
import ApiError from "./apiError";
import { ResponseMsg, ResponseUser } from "./dataTypes";

export default async function postAuth(authData: AuthData)
{
	const res = await fetchPost("/api/auth", authData);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return data as ResponseUser;
}

interface AuthData
{
	login: string,
	password: string,
}
