import { type QueryClient } from "@tanstack/react-query";
import { ApiError } from "./dataTypes";
import { type User, type UserData, createEmptyUser, queryKey } from "./user";
import { stdMutation, stdMutationNoRes } from "../utils/mutations";

// Cancel pending reads before removing data belonging to the previous session.
export async function setSessionUser(client: QueryClient, user: User)
{
	await client.cancelQueries();
	client.removeQueries({ predicate: query => query.queryKey[0] != queryKey()[0] });
	client.setQueryData(queryKey(), user);
}

interface AuthData { login: string; password: string; }
const useAuth = stdMutation<AuthData, UserData>("/api/auth", (client, user) => setSessionUser(client, { ...user, auth: true }));
export function useMutationAuth(onError?: (msg: string) => void)
{
	return useAuth(undefined, error => onError?.(error instanceof ApiError ? error.message : "Произошла ошибка, попробуйте ещё раз"));
}

export const useMutationLogout = stdMutationNoRes<void>("/api/logout", client => setSessionUser(client, createEmptyUser()));
