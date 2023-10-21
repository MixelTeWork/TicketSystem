import { useMutation, useQuery, useQueryClient } from "react-query";
import ApiError from "./apiError";
import { ResponseMsg, User, UserFull } from "./dataTypes";
import fetchPost from "../utils/fetchPost";

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

async function getUsers(): Promise<UserFull[]>
{
	const res = await fetch("/api/users");
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);

	return data as UserFull[];
}

export function useMutationChangePassword(onSuccess?: () => void)
{
	const mutation = useMutation({
		mutationFn: postChangePassword,
		onSuccess: onSuccess,
	});
	return mutation;
}

async function postChangePassword(data: ChangePasswordData)
{
	const res = await fetchPost("/api/user/change_password", data);
	if (!res.ok) throw new ApiError((await res.json() as ResponseMsg).msg);
}

interface ChangePasswordData
{
	password: string;
}

export function useMutationChangeName(onSuccess?: () => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: postChangeName,
		onSuccess: (data: ChangeName) =>
		{
			if (queryClient.getQueryState("user")?.status == "success")
				queryClient.setQueryData("user", (user?: User) => ({ ...user!, name: data.name }));
			onSuccess?.();
		},
	});
	return mutation;
}

async function postChangeName(data: ChangeName)
{
	const res = await fetchPost("/api/user/change_name", data);
	if (!res.ok) throw new ApiError((await res.json() as ResponseMsg).msg);
	return data;
}

interface ChangeName
{
	name: string;
}