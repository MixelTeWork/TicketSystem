import { useEffect } from "react";
import { Font } from "../api/dataTypes";

export default function useFont(font: Font)
{
	const fontName = `${font.id}_${font.name}`;
	useEffect(() =>
	{
		const myFont = newFontFace(fontName, font.id, font.type);
		document.fonts.add(myFont);
		return () =>
		{
			document.fonts.delete(myFont);
		}
	}, []);
	return `"${fontName}"`;
}

export function newFontFace(family: string, id: number, type: keyof typeof fontTypes)
{
	return new FontFace(family, `url("/api/font/${id}")  format("${fontTypes[type]}")`);
}

const fontTypes = {
	otf: "opentype",
	ttf: "truetype",
	woff: "woff",
	woff2: "woff2",
}
