import { ApiError } from "./dataTypes";
import { type UserData, createEmptyUser } from "./user";
import { setSessionUser } from "./session";
import { stdMutation, stdMutationNoRes } from "../utils/mutations";

interface AuthData { login: string; password: string; }
const useAuth = stdMutation<AuthData, UserData>("/api/auth", (client, user) => setSessionUser(client, { ...user, auth: true }));
export function useMutationAuth(onError?: (msg: string) => void)
{
	return useAuth(undefined, error => onError?.(error instanceof ApiError ? error.message : "Произошла ошибка, попробуйте ещё раз"));
}

export const useMutationLogout = stdMutationNoRes<void>("/api/logout", client => setSessionUser(client, createEmptyUser()));
