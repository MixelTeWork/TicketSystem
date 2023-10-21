import { useQuery } from "react-query";
import ApiError from "./apiError";
import { ResponseMsg, User } from "./dataTypes";

export default function useUser()
{
	return useQuery("user", getUser);
}

async function getUser(): Promise<User>
{
	const res = await fetch("/api/user");
	const data = await res.json();

	if (res.status == 401) return { auth: false, id: -1, login: "", role: "", name: "", operations: [] };
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);

	const user = data as User;
	user.auth = true;
	return user;
}

export function useUsers()
{
	return useQuery("users", getUsers);
}

async function getUsers(): Promise<User[]>
{
	const res = await fetch("/api/users");
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);

	return data as User[];
}
