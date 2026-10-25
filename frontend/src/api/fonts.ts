import { useQueryClient } from "@tanstack/react-query";
import { useSessionMutation } from "../utils/useSessionMutation";

import { fetchPostForm } from "../utils/fetch";
import { queryListAddItem, stdQuery } from "../utils/query";

const url = "/api/fonts";
export const queryKey = () => ["fonts"];
export const useFonts = stdQuery<Font[]>(queryKey(), url);

export function useMutationNewFont(onSuccess?: () => void)
{
	const queryClient = useQueryClient();
	const mutation = useSessionMutation({
		mutationFn: async (fontData: NewFontData) =>
		{
			const formData = new FormData();
			formData.set("name", fontData.name);
			formData.set("type", fontData.type);
			formData.set("font", fontData.file);

			return await fetchPostForm<Font>(url, formData);
		},
		onSuccess: data =>
		{
			queryListAddItem(queryClient, queryKey(), data);
			onSuccess?.();
		},
	});
	return mutation;
}

interface NewFontData
{
	name: string,
	type: Font["type"],
	file: File,
}

export interface Font
{
	id: number,
	name: string,
	type: "ttf" | "otf" | "woff" | "woff2",
}
