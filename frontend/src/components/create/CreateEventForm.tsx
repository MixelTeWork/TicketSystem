import { useEffect, useRef } from "react";
import { Form, FormField } from "../Form";
import Popup, { PopupProps } from "../Popup";
import { useMutationNewEvent } from "../../api/events";
import Spinner from "../Spinner";
import displayError from "../../utils/displayError";

export default function CreateEventForm({ open, close }: PopupProps)
{
	const inp_title = useRef<HTMLInputElement>(null);
	const inp_date = useRef<HTMLInputElement>(null);
	const mutation = useMutationNewEvent(close);

	useEffect(() =>
	{
		if (!open && inp_title.current && inp_date.current)
		{
			inp_title.current.value = "";
			inp_date.current.value = "";
		}
	}, [open, inp_title, inp_date]);

	return (
		<Popup open={open} close={close} title="Добавление меропрятия">
			{displayError(mutation)}
			<Form onSubmit={() =>
			{
				const title = inp_title.current?.value;
				const date = inp_date.current?.value;
				if (title && date)
					mutation.mutate({ date: date, name: title });
			}}>
				<FormField label="Название">
					<input ref={inp_title} type="text" required />
				</FormField>
				<FormField label="Дата">
					<input ref={inp_date} type="datetime-local" required />
				</FormField>
				<button type="submit" className="button button_small">Создать</button>
			</Form>
			{mutation.isLoading && <Spinner />}
		</Popup>
	);
}
