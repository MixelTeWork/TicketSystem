import useStateBool from "../../utils/useStateBool";
import useStateObj from "../../utils/useStateObj";
import { useFonts } from "../../api/fonts";
import Layout from "../../components/Layout";
import Spinner from "../../components/Spinner";
import displayError from "../../utils/displayError";
import { useTitle } from "../../utils/useTitle";
import CreateFontForm from "../../components/create/CreateFontForm";
import { useHasPermission } from "../../api/operations";
import { type Font } from "../../api/dataTypes";
import useFont from "../../utils/useFont";

export default function FontsPage()
{
	useTitle("Шрифты");
	const createFontOpen = useStateBool(false);
	const exampleText = useStateObj("Мыши булочки жевали!");
	const fonts = useFonts();

	return (
		<Layout centeredPage gap={12}>
			<h1>Шрифты</h1>
			{fonts.isLoading && <Spinner />}
			{displayError(fonts)}

			<input type="text" value={exampleText.v} onInput={e => exampleText.set((e.target as HTMLInputElement).value)} />

			{fonts.data?.map(v => <FontPreview key={v.id} font={v} text={exampleText.v} />)}

			{useHasPermission("add_font") &&
				<div className="space_between">
					<span></span>
					<button className="button" onClick={createFontOpen.setT}>Добавить</button>
				</div>
			}
			<CreateFontForm open={createFontOpen.v} close={createFontOpen.setF} />
		</Layout>
	);
}

function FontPreview({ font, text }: { font: Font, text: string })
{
	const fontName = useFont(font);
	return <div className="space_between" style={{ fontFamily: fontName, fontSize: "1.2rem", gap: "0 1rem", flexWrap: "wrap" }}>
		<span>{font.name}</span>
		<span>{text}</span>
	</div>;
}
