import { useQuery } from "react-query";
import ApiError from "./apiError";
import { ResponseMsg, User } from "./dataTypes";

export default function useUser()
{
	return useQuery("user", getUser, { staleTime: Infinity, cacheTime: Infinity })
}

async function getUser(): Promise<User>
{
	const res = await fetch("/api/user");
	const data = await res.json();

	if (res.status == 401) return { auth: false, login: "", name: "", operations: [] };
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);

	const user = data as User;
	user.auth = true;
	return user;
}
