import { ApiError } from "../../api/dataTypes";
import { useEffect, useRef } from "react";
import { Form, FormField } from "../Form";
import Popup, { type PopupProps } from "../Popup";
import Spinner from "../Spinner";
import displayError from "../../utils/displayError";
import { useMutationNewFont } from "../../api/fonts";
import useStateObj from "../../utils/useStateObj";

export default function CreateFontForm({ open, close }: PopupProps)
{
	const name = useStateObj("");
	const inp_file = useRef<HTMLInputElement>(null);
	const mutation = useMutationNewFont(close);
	const { reset } = mutation;

	useEffect(() =>
	{
		const setName = name.set;
		if (!open)
		{
			setName("");
			if (inp_file.current)
			{
				inp_file.current.value = "";
				inp_file.current.setCustomValidity("");
			}
			reset();
		}
	}, [open, name.set, reset]);

	return (
		<Popup open={open} close={close} title="Добавление шрифта">
			{mutation.error instanceof ApiError && mutation.error.code == "font_exists" ? <p className="danger-text" role="alert">Шрифт с таким названием уже существует</p> : displayError(mutation)}
			<Form disabled={mutation.isPending} onSubmit={() =>
			{
				const file = inp_file.current?.files?.[0];
				const type = file?.name.split(".").at(-1)?.toLowerCase();
				if (name.v && file && (type == "ttf" || type == "otf" || type == "woff" || type == "woff2"))
					mutation.mutate({ file, name: name.v, type });
			}}>
				<FormField label="Файл">
					<input
						ref={inp_file}
						type="file"
						accept=".ttf,.otf,.woff,.woff2"
						required
						onChange={e =>
						{
							const file = e.currentTarget;
							const filename = file.files?.[0]?.name || "";
							const extension = filename.split(".").at(-1)?.toLowerCase();
							file.setCustomValidity(extension && ["ttf", "otf", "woff", "woff2"].includes(extension) ? "" : "Выберите файл шрифта ttf, otf, woff или woff2");
							const splited = filename.split(".");
							const fontName = splited.length == 1 ? splited : splited.slice(0, -1);
							name.set(fontName.join("."));
						}}
					/>
				</FormField>
				<FormField label="Название">
					<input value={name.v} onChange={e => name.set(e.target.value)} type="text" required />
				</FormField>
				<button type="submit" className="button button_small" disabled={mutation.isPending}>Создать</button>
			</Form>
			{mutation.isPending && <Spinner />}
		</Popup>
	);
}
