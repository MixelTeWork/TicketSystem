import { useMutation, useQueryClient } from "react-query";
import fetchPost from "../utils/fetchPost"
import ApiError from "./apiError";
import { ResponseMsg, User } from "./dataTypes";

export function useMutationAuth(onError?: (msg: string) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: postAuth,
		onSuccess: (data) =>
		{
			queryClient.setQueryData("user", () => data);
		},
		onError: (error) =>
		{
			onError?.(error instanceof ApiError ? error.message : "Произошла ошибка, попробуйте ещё раз");
		}
	});
	return mutation;
}

async function postAuth(authData: AuthData)
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

export function useMutationLogout()
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: postLogout,
		onSuccess: () =>
		{
			queryClient.invalidateQueries("user");
		}
	});
	return mutation;
}
