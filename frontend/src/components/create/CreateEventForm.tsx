import { useEffect, useRef } from "react";
import { useMutationNewEvent } from "../../api/events";
import { EVENT_DATE_MAX, EVENT_DATE_MIN, inputToUtc } from "../../utils/dates";
import displayError from "../../utils/displayError";
import { Form, FormField } from "../Form";
import Popup, { type PopupProps } from "../Popup";
import Spinner from "../Spinner";

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

	useEffect(() =>
	{
		if (!open)
			mutation.reset();
		// eslint-disable-next-line
	}, [open]);

	return (
		<Popup open={open} close={close} title="Добавление мероприятия">
			{displayError(mutation)}
			<Form disabled={mutation.isPending} onSubmit={() =>
			{
				const title = inp_title.current?.value;
				const date = inp_date.current?.value;
				if (title && date)
					mutation.mutate({ date: inputToUtc(date), name: title });
			}}>
				<FormField label="Название">
					<input ref={inp_title} type="text" required />
				</FormField>
				<FormField label="Дата (МСК)">
					<input ref={inp_date} type="datetime-local" step="1" min={EVENT_DATE_MIN} max={EVENT_DATE_MAX} required />
				</FormField>
				<button type="submit" className="button button_small" disabled={mutation.isPending}>Создать</button>
			</Form>
			{mutation.isPending && <Spinner />}
		</Popup>
	);
}
