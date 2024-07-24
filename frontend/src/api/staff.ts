import { useQuery, useQueryClient, useMutation } from "react-query";
import fetchDelete from "../utils/fetchDelete";
import fetchPost from "../utils/fetchPost";
import ApiError from "./apiError";
import { UserWithPwd, ResponseMsg } from "./dataTypes";


export function useStaff()
{
	return useQuery("staff", getStaff);
}

async function getStaff(): Promise<UserWithPwd[]>
{
	const res = await fetch("/api/staff");
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);

	return data as UserWithPwd[];
}

export function useStaffEvent(eventId: number | string)
{
	return useQuery(["staff", `${eventId}`], () => getStaffEvent(eventId));
}

async function getStaffEvent(eventId: number | string): Promise<UserWithPwd[]>
{
	const res = await fetch(`/api/events/${eventId}/staff`);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);

	return data as UserWithPwd[];
}

export function useMutationUpdateStaff(eventId: number | string, onSuccess?: () => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: (staffData: StaffData) => postStaff(eventId, staffData),
		onSuccess: (data) =>
		{
			if (queryClient.getQueryState(["staff", `${eventId}`])?.status == "success")
				queryClient.setQueryData(["staff", `${eventId}`], data);
			onSuccess?.();
		},
	});
	return mutation;
}

async function postStaff(eventId: number | string, staffData: StaffData)
{
	const res = await fetchPost(`/api/events/${eventId}/staff`, staffData);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);

	return data as UserWithPwd[];
}
type StaffData = number[];

export function useMutationNewStaff(onSuccess?: (staff: UserWithPwd) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: postNewStaff,
		onSuccess: (data) =>
		{
			if (queryClient.getQueryState("staff")?.status == "success")
				queryClient.setQueryData("staff", (staff?: UserWithPwd[]) => staff ? [...staff, data] : [data]);
			onSuccess?.(data);
		},
	});
	return mutation;
}

async function postNewStaff(newStaffData: NewStaffData)
{
	const res = await fetchPost("/api/staff", newStaffData);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return data as UserWithPwd;
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
		mutationFn: () => postDeleteStaff(staffId),
		onSuccess: () =>
		{
			if (queryClient.getQueryState("staff")?.status == "success")
				queryClient.setQueryData("staff", (staff?: UserWithPwd[]) => staff ? staff.filter(v => v.id != staffId) : []);
			onSuccess?.();
		},
	});
	return mutation;
}

async function postDeleteStaff(staffId: number | string)
{
	const res = await fetchDelete("/api/staff/" + staffId);
	if (!res.ok) throw new ApiError((await res.json() as ResponseMsg).msg);
}

export function useMutationResetStaffPassword(staffId: number | string, onSuccess?: (staff: UserWithPwd) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: () => postResetStaffPassword(staffId),
		onSuccess: (data) =>
		{
			if (queryClient.getQueryState("staff")?.status == "success")
				queryClient.setQueryData("staff", (staff?: UserWithPwd[]) => staff ? staff.map(v => v.id != staffId ? v : data) : []);
			onSuccess?.(data);
		},
	});
	return mutation;
}

async function postResetStaffPassword(staffId: number | string)
{
	const res = await fetchPost(`/api/staff/${staffId}/reset_password`);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return data as UserWithPwd;
}
