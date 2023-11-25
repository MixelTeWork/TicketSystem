import { ImgData } from "../api/dataTypes";

export default async function imagefileToData(file: File, name: string, accessEventId?: number)
{
	const imgBase64 = await new Promise((resolve: (a: { result: string | ArrayBuffer | null, error: string | DOMException | null }) => void) =>
	{
		var reader = new FileReader();
		reader.addEventListener("loadend", e =>
		{
			resolve({
				result: reader.result,
				error: reader.error,
			});
		});
		reader.readAsDataURL(file);
	});
	if (imgBase64.error)
	{
		console.error(imgBase64.error);
		return null;
	}
	return <ImgData>{
		data: imgBase64.result,
		name,
		accessEventId,
	}
}