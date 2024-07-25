import { useMutation, useQuery, useQueryClient } from "react-query";
import { Font } from "./dataTypes";
import { fetchJsonGet, fetchPostForm } from "../utils/fetch";

export function useFonts()
{
	return useQuery("fonts", async () =>
		await fetchJsonGet<Font[]>("/api/fonts")
	);
}

export function useMutationNewFont(onSuccess?: () => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async (fontData: NewFontData) =>
		{
			const formData = new FormData();
			formData.set("name", fontData.name);
			formData.set("type", fontData.type);
			formData.set("font", fontData.file);

			return await fetchPostForm<Font>("/api/fonts", formData);
		},
		onSuccess: (data) =>
		{
			if (queryClient.getQueryState("fonts")?.status == "success")
				queryClient.setQueryData("fonts", (fonts?: Font[]) => fonts ? [...fonts, data] : [data]);
			onSuccess?.();
		},
	});
	return mutation;
}

interface NewFontData
{
	name: string,
	type: string,
	file: File,
}
