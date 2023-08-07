import { useQuery } from "react-query";
import ApiError from "./apiError";
import { ResponseMsg, ResponseUser } from "./dataTypes";

export default function useUser()
{
	return useQuery("user", getUser, { staleTime: Infinity, cacheTime: Infinity })
}

async function getUser()
{
	const res = await fetch("/api/user");
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return data as ResponseUser;
}
