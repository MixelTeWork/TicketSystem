import { useQuery, useQueryClient, useMutation } from "react-query";
import { UserWithPwd } from "./dataTypes";
import { fetchDelete, fetchJsonGet, fetchJsonPost } from "../utils/fetch";
import { queryListAddItem, queryListDeleteItem, queryListUpdateItem } from "../utils/query";


export function useStaff()
{
	return useQuery("staff", async () =>
		await fetchJsonGet<UserWithPwd[]>("/api/staff"),
	);
}

export function useStaffEvent(eventId: number | string)
{
	return useQuery(["staff", `${eventId}`], async () =>
		await fetchJsonGet<UserWithPwd[]>(`/api/events/${eventId}/staff`),
	);
}


export function useMutationUpdateStaff(eventId: number | string, onSuccess?: () => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async (staffData: StaffData) =>
			await fetchJsonPost<UserWithPwd[]>(`/api/events/${eventId}/staff`, staffData),
		onSuccess: (data) =>
		{
			queryClient.setQueryData(["staff", `${eventId}`], data);
			onSuccess?.();
		},
	});
	return mutation;
}
type StaffData = number[];

export function useMutationNewStaff(onSuccess?: (staff: UserWithPwd) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async (newStaffData: NewStaffData) =>
			await fetchJsonPost<UserWithPwd>("/api/staff", newStaffData),
		onSuccess: (data) =>
		{
			queryListAddItem(queryClient, "staff", data);
			onSuccess?.(data);
		},
	});
	return mutation;
}

interface NewStaffData
{
	name: string;
	login: string;
}

export function useMutationDeleteStaff(staffId: number | string, onSuccess?: () => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async () =>
			await fetchDelete("/api/staff/" + staffId),
		onSuccess: () =>
		{
			queryListDeleteItem(queryClient, "events", staffId);
			onSuccess?.();
		},
	});
	return mutation;
}

export function useMutationResetStaffPassword(staffId: number | string, onSuccess?: (staff: UserWithPwd) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async () =>
			await fetchJsonPost<UserWithPwd>(`/api/staff/${staffId}/reset_password`),
		onSuccess: (data) =>
		{
			queryListUpdateItem(queryClient, "staff", data);
			onSuccess?.(data);
		},
	});
	return mutation;
}
