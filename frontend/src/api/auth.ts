import fetchPost from "../utils/fetchPost"
import ApiError from "./apiError";
import { ResponseMsg, User } from "./dataTypes";

export default async function postAuth(authData: AuthData)
{
	const res = await fetchPost("/api/auth", authData);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);

	const user = data as User;
	user.auth = true;
	return user;
}

export async function postLogout()
{
	await fetchPost("/api/logout");
}

interface AuthData
{
	login: string,
	password: string,
}
