import { useQuery, useQueryClient, useMutation } from "react-query";
import { UserWithPwd } from "./dataTypes";
import { fetchDelete, fetchJsonGet, fetchJsonPost } from "../utils/fetch";


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
			if (queryClient.getQueryState("managers")?.status == "success")
				queryClient.setQueryData("managers", (managers?: UserWithPwd[]) => managers ? [...managers, data] : [data]);
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
			if (queryClient.getQueryState("managers")?.status == "success")
				queryClient.setQueryData("managers", (managers?: UserWithPwd[]) => managers ? managers.filter(v => v.id != managerId) : []);
			onSuccess?.();
		},
	});
	return mutation;
}
