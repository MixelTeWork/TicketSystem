import { useEffect } from "react";
import { Font } from "../api/dataTypes";

export default function useFont(font: Font)
{
	const fontName = `"${font.id}_${font.name}"`;
	useEffect(() =>
	{
		const styles = `
@font-face {
	font-family: ${fontName};
	src: url("/api/font/${font.id}") format("${fontTypes[font.type]}");
}
`
		const el = document.createElement("style");
		el.innerHTML = styles;
		document.head.appendChild(el);
		return () =>
		{
			document.head.removeChild(el);
		}
	}, []);
	return fontName;
}

const fontTypes = {
	otf: "opentype",
	ttf: "truetype",
	woff: "woff",
	woff2: "woff2",
}
