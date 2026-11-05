import { ApiError } from "../api/dataTypes";
import type { ImgData } from "../api/ticketTypes";

export default async function imagefileToData(file: File, name: string, accessEventId: number): Promise<ImgData>
{
	const data = await new Promise<string>((resolve, reject) =>
	{
		const reader = new FileReader();
		const failed = () => reject(new ApiError("Не удалось прочитать картинку"));
		reader.addEventListener("error", failed);
		reader.addEventListener("abort", failed);
		reader.addEventListener("load", () => typeof reader.result == "string" ? resolve(reader.result) : failed());
		reader.readAsDataURL(file);
	});
	return { data, name, accessEventId };
}
