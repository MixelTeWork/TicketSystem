export function saveCanvasAsPng(canvas: HTMLCanvasElement, fname: string)
{
	const a = document.createElement("a");
	a.setAttribute("download", fname);

	canvas.toBlob(blob =>
	{
		if (!blob) return;
		const url = URL.createObjectURL(blob);
		a.setAttribute("href", url);
		a.click();
		URL.revokeObjectURL(url);
	});
}