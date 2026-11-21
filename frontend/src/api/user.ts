import { useQuery } from "@tanstack/react-query";
import { fetchJsonGet } from "../utils/fetch";
import { stdQuery } from "../utils/query";
import { stdMutationNoRes } from "../utils/mutations";

export type UserRole = [id: number, name: string];
export interface UserData
{
	id: number;
	name: string;
	login: string;
	roles: string[];
	operations: string[];
}
export interface User extends UserData { auth: boolean; }
export interface UserFull extends Omit<UserData, "roles">
{
	roles: UserRole[];
	bossId: number | null;
	deleted: boolean;
	access: number[];
}
export interface UserWithPwd extends UserData { password: string; }
export interface StaffMember extends UserData { password?: string; access?: number[]; }
export interface NewUserData { name: string; login: string; }

const url = "/api/user";
export const queryKey = () => ["user"];
export const queryKeyList = () => ["users"];

export function createEmptyUser(): User
{
	return { auth: false, id: -1, login: "", roles: [], name: "", operations: [] };
}

export default function useUser()
{
	return useQuery({
		queryKey: queryKey(),
		queryFn: async ({ signal }) =>
		{
			const user = await fetchJsonGet<UserData>(url, signal);
			return { ...user, auth: true };
		},
	});
}

export const useUsers = stdQuery<UserFull[]>(queryKeyList(), "/api/users");
interface ChangePasswordData { password: string; }
export const useMutationChangePassword = stdMutationNoRes<ChangePasswordData>(`${url}/change_password`);
interface ChangeNameData { name: string; }
export const useMutationChangeName = stdMutationNoRes<ChangeNameData>(`${url}/change_name`, (client, data) =>
{
	client.setQueryData(queryKey(), (user?: User) => user ? { ...user, name: data.name } : undefined);
	return client.invalidateQueries({ queryKey: queryKeyList() });
});
