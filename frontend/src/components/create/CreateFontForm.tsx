import { useEffect, useRef } from "react";
import { Form, FormField } from "../Form";
import Popup, { PopupProps } from "../Popup";
import Spinner from "../Spinner";
import displayError from "../../utils/displayError";
import { useMutationNewFont } from "../../api/fonts";

export default function CreateFontForm({ open, close }: PopupProps)
{
	const inp_name = useRef<HTMLInputElement>(null);
	const inp_file = useRef<HTMLInputElement>(null);
	const mutation = useMutationNewFont(close);

	useEffect(() =>
	{
		if (!open && inp_name.current && inp_file.current)
		{
			inp_name.current.value = "";
			inp_file.current.value = "";
		}
	}, [open, inp_name, inp_file]);

	useEffect(() =>
	{
		if (!open)
			mutation.reset();
		// eslint-disable-next-line
	}, [open]);

	return (
		<Popup open={open} close={close} title="Добавление шрифта">
			{displayError(mutation)}
			<Form onSubmit={() =>
			{
				const name = inp_name.current?.value;
				const file = inp_file.current?.files?.[0];
				if (name && file)
					mutation.mutate({ file, name, type: file.name.split(".").at(-1) || "" });
			}}>
				<FormField label="Файл">
					<input
						ref={inp_file}
						type="file"
						accept=".ttf,.woff,.woff2"
						required
						onChange={() =>
						{
							const name = inp_name.current;
							const file = inp_file.current;
							if (!name || !file) return;
							const filename = file.files?.[0]?.name || "";
							const splited = filename.split(".")
							const fontName = splited.length == 1 ? splited : splited.slice(0, -1);
							name.value = fontName.join(".");
						}}
					/>
				</FormField>
				<FormField label="Название">
					<input ref={inp_name} type="text" required />
				</FormField>
				<button type="submit" className="button button_small">Создать</button>
			</Form>
			{mutation.isLoading && <Spinner />}
		</Popup>
	);
}
