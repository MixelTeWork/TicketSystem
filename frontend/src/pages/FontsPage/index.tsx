import type { Font } from "../../api/fonts";
import { useFonts } from "../../api/fonts";
import { useHasPermission } from "../../api/operations";
import CreateFontForm from "../../components/create/CreateFontForm";
import Layout from "../../components/Layout";
import { DataTable, EmptyState, matchesSearch, PageHeading, SearchField } from "../../components/Page";
import Spinner from "../../components/Spinner";
import displayError from "../../utils/displayError";
import useFont from "../../utils/useFont";
import useStateBool from "../../utils/useStateBool";
import useStateObj from "../../utils/useStateObj";
import { useTitle } from "../../utils/useTitle";

export default function FontsPage()
{
	useTitle("Шрифты");
	const createFontOpen = useStateBool(false);
	const exampleText = useStateObj("Мыши булочки жевали!");
	const search = useStateObj("");
	const fonts = useFonts();
	const canAdd = useHasPermission("add_font");
	const filtered = fonts.data?.filter(font => matchesSearch(font.name, search.v));
	return <Layout backLink="/" centeredPage>
		<PageHeading title="Шрифты">{canAdd && <button className="button button_primary" onClick={createFontOpen.setT}>＋ Добавить</button>}</PageHeading>
		<div className="toolbar"><SearchField value={search.v} onChange={search.set} placeholder="Название шрифта" /><label className="search-field">Текст образца<input value={exampleText.v} onChange={e => exampleText.set(e.target.value)} /></label></div>
		{fonts.isLoading && <Spinner />}{displayError(fonts)}
		{fonts.isSuccess && <DataTable><thead><tr><th>Шрифт</th><th>Образец</th></tr></thead><tbody>
			{filtered?.map(font => <FontPreview key={font.id} font={font} text={exampleText.v} />)}
			{filtered?.length == 0 && <tr><td colSpan={2}><EmptyState /></td></tr>}
		</tbody></DataTable>}
		<CreateFontForm open={createFontOpen.v} close={createFontOpen.setF} />
	</Layout>;
}

function FontPreview({ font, text }: { font: Font, text: string })
{
	const fontName = useFont(font);
	return <tr><td>{font.name}<div className="muted">{font.type}</div></td><td style={{ fontFamily: fontName, fontSize: 22 }}>{text}</td></tr>;
}
