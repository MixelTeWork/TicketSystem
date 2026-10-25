import { type NewUserData, type StaffMember, type UserData, type UserWithPwd, queryKeyList as userListKey } from "./user";
import { queryListAddItem, queryInvalidate, stdQuery, itemQuery, type ItemId } from "../utils/query";
import { queryKeyFull as eventsFullKey } from "./events";
import { stdMutation, itemMutation, itemDeleteMutation } from "../utils/mutations";

const url = "/api/staff";
export const queryKey = () => ["staff"];
export const queryKeyEvent = (id: ItemId) => [...queryKey(), `${id}`];

export const useStaff = stdQuery<StaffMember[]>(queryKey(), url);
export const useStaffEvent = itemQuery<UserData[]>(queryKeyEvent, id => `/api/events/${id}/staff`);
export function useMutationUpdateStaff(eventId: ItemId, onSuccess?: () => void)
{
	const useUpdate = stdMutation<number[], UserData[]>(`/api/events/${eventId}/staff`, (client, data) =>
	{
		client.setQueryData(queryKeyEvent(eventId), data);
		return Promise.all([queryInvalidate(client, queryKey()), queryInvalidate(client, userListKey()), queryInvalidate(client, eventsFullKey())]);
	});
	return useUpdate(onSuccess);
}
export type StaffRole = "clerk" | "usher";
export const useMutationStaffAccess = itemMutation<number[], StaffMember>(id => `${url}/${id}/access`, (client, data) =>
{
	client.setQueryData<StaffMember[]>(queryKey(), items => items?.map(item => item.id == data.id ? { ...item, ...data } : item));
	return Promise.all([queryInvalidate(client, queryKey(), false), queryInvalidate(client, userListKey()), queryInvalidate(client, eventsFullKey())]);
});
export function useMutationNewStaff(onSuccess?: (user: UserWithPwd) => void, role: StaffRole = "clerk")
{
	const useCreate = stdMutation<NewUserData, UserWithPwd>(url, (client, data) =>
	{
		queryListAddItem(client, queryKey(), data);
		return Promise.all([queryInvalidate(client, userListKey()), queryInvalidate(client, eventsFullKey())]);
	}, data => ({ ...data, role }));
	return useCreate(onSuccess);
}
export const useMutationDeleteStaff = itemDeleteMutation(url, (client, id) =>
{
	client.setQueriesData<StaffMember[]>({ queryKey: queryKey() }, items => items?.filter(item => item.id != id));
	return Promise.all([queryInvalidate(client, userListKey()), queryInvalidate(client, eventsFullKey())]);
});
export const useMutationResetStaffPassword = itemMutation<void, UserWithPwd>(id => `${url}/${id}/reset_password`, (client, data) =>
{
	client.setQueryData<StaffMember[]>(queryKey(), items => items?.map(item => item.id == data.id ? { ...item, ...data } : item));
});
