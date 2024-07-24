import { useMutation, useQuery, useQueryClient } from "react-query";
import { Font, ResponseMsg } from "./dataTypes";
import ApiError from "./apiError";

export function useFonts()
{
	return useQuery("fonts", getFonts);
}

async function getFonts(): Promise<Font[]>
{
	const res = await fetch("/api/fonts");
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return data as Font[];
}

export function useMutationNewFont(onSuccess?: () => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: postNewFont,
		onSuccess: (data) =>
		{
			if (queryClient.getQueryState("fonts")?.status == "success")
				queryClient.setQueryData("fonts", (fonts?: Font[]) => fonts ? [...fonts, data] : [data]);
			onSuccess?.();
		},
	});
	return mutation;
}

async function postNewFont(fontData: NewFontData)
{
	const formData = new FormData();
	formData.set("name", fontData.name);
	formData.set("type", fontData.type);
	formData.set("font", fontData.file);

	const res = await fetch("/api/fonts", {
		method: "POST",
		body: formData,
	});
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return data;
}

interface NewFontData
{
	name: string,
	type: string,
	file: File,
}
