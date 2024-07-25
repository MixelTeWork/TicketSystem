import { useQuery, useQueryClient, useMutation } from "react-query";
import { UserWithPwd } from "./dataTypes";
import { fetchDelete, fetchJsonGet, fetchJsonPost } from "../utils/fetch";
import { queryListAddItem, queryListDeleteItem } from "../utils/query";


export function useManagers()
{
	return useQuery("managers", async () =>
		await fetchJsonGet<UserWithPwd[]>("/api/managers"),
	);
}

export function useMutationNewManager(onSuccess?: (manager: UserWithPwd) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async (newManagerData: NewManagerData) =>
			await fetchJsonPost<UserWithPwd>("/api/managers", newManagerData),
		onSuccess: (data) =>
		{
			queryListAddItem(queryClient, "managers", data);
			onSuccess?.(data);
		},
	});
	return mutation;
}

interface NewManagerData
{
	name: string;
	login: string;
}


export function useMutationDeleteManager(managerId: number | string, onSuccess?: () => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async () =>
			await fetchDelete("/api/managers/" + managerId),
		onSuccess: () =>
		{
			queryListDeleteItem(queryClient, "managers", managerId);
			onSuccess?.();
		},
	});
	return mutation;
}
