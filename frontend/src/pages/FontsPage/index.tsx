import { useState } from "react";
import { useFonts } from "../../api/fonts";
import Layout from "../../components/Layout";
import Spinner from "../../components/Spinner";
import displayError from "../../utils/displayError";
import { useTitle } from "../../utils/useTtile";
import CreateFontForm from "../../components/create/CreateFontForm";
import { useHasPermission } from "../../api/operations";

export default function FontsPage()
{
	useTitle("Шрифты");
	const [createFontOpen, setCreateFontOpen] = useState(false);
	const fonts = useFonts();

	return (
		<Layout centeredPage gap={8}>
			<h1>Шрифты</h1>
			{fonts.isLoading && <Spinner />}
			{displayError(fonts)}

			{fonts.data?.map(v => <div key={v.id}>{v.name}</div>)}

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
