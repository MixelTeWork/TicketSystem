import { useMutation, useQueryClient } from "react-query";
import { ApiError, User } from "./dataTypes";
import { fetchJsonPost, fetchPost } from "../utils/fetch";
import { createEmptyUser } from "./user";

export function useMutationAuth(onError?: (msg: string) => void)
{
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (authData: AuthData) =>
		{
			const user = await fetchJsonPost<User>("/api/auth", authData);
			user.auth = true;
			return user;
		},
		onSuccess: (data) =>
		{
			queryClient.setQueryData("user", () => data);
		},
		onError: (error) =>
		{
			onError?.(error instanceof ApiError ? error.message : "Произошла ошибка, попробуйте ещё раз");
		}
	});
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
		mutationFn: () => fetchPost("/api/logout"),
		onSuccess: () =>
		{
			queryClient.setQueryData("user", (_?: User) => createEmptyUser());
		}
	});
	return mutation;
}
