import { useState } from "react";
import { useFonts } from "../../api/fonts";
import Layout from "../../components/Layout";
import Spinner from "../../components/Spinner";
import displayError from "../../utils/displayError";
import { useTitle } from "../../utils/useTtile";
import CreateFontForm from "../../components/create/CreateFontForm";
import { useHasPermission } from "../../api/operations";
import { Font } from "../../api/dataTypes";
import useFont from "../../utils/useFont";

export default function FontsPage()
{
	useTitle("Шрифты");
	const [createFontOpen, setCreateFontOpen] = useState(false);
	const [exampleText, setExampleText] = useState("Мыши булочки жевали!");
	const fonts = useFonts();

	return (
		<Layout centeredPage gap={12}>
			<h1>Шрифты</h1>
			{fonts.isLoading && <Spinner />}
			{displayError(fonts)}

			<input type="text" value={exampleText} onInput={e => setExampleText((e.target as HTMLInputElement).value)} />

			{fonts.data?.map(v => <FontPreview key={v.id} font={v} text={exampleText} />)}

			{useHasPermission("add_font") &&
				<div className="space_between">
					<span></span>
					<button className="button" onClick={() => setCreateFontOpen(true)}>Добавить</button>
				</div>
			}
			<CreateFontForm open={createFontOpen} close={() => setCreateFontOpen(false)} />
		</Layout>
	);
}

function FontPreview({ font, text }: { font: Font, text: string })
{
	const fontName = useFont(font);
	return <div className="space_between" style={{ fontFamily: fontName, fontSize: "1.2rem", gap: "0 1rem", flexWrap: "wrap" }}>
		<span>{font.name}</span>
		<span>{text}</span>
	</div>
}
