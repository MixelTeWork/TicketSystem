import { type NewUserData, type UserData, type UserWithPwd, queryKeyList as userListKey } from "./user";
import { queryListAddItem, queryListDeleteItem, queryInvalidate, stdQuery } from "../utils/query";
import { queryKeyFull as eventsFullKey } from "./events";
import { stdMutation, itemDeleteMutation } from "../utils/mutations";

const url = "/api/managers";
export const queryKey = () => ["managers"];

export const useManagers = stdQuery<UserData[]>(queryKey(), url);

export const useMutationNewManager = stdMutation<NewUserData, UserWithPwd>(url, (client, data) =>
{
	queryListAddItem(client, queryKey(), data);
	return Promise.all([queryInvalidate(client, userListKey()), queryInvalidate(client, eventsFullKey())]);
});
export const useMutationDeleteManager = itemDeleteMutation(url, (client, id) =>
{
	queryListDeleteItem(client, queryKey(), id);
	return Promise.all([queryInvalidate(client, userListKey()), queryInvalidate(client, eventsFullKey())]);
});
