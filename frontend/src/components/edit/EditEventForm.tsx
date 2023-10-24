import { useRef } from "react";
import { Form, FormField } from "../Form";
import Popup, { PopupProps } from "../Popup";
import { useEvent, useMutationUpdateEvent } from "../../api/events";
import Spinner from "../Spinner";
import displayError from "../../utils/displayError";

export default function EditEventForm({ eventId, open, close }: EditEventFormProps)
{
	const inp_title = useRef<HTMLInputElement>(null);
	const inp_date = useRef<HTMLInputElement>(null);
	const mutation = useMutationUpdateEvent(eventId, close);
	const event = useEvent(eventId);

	return (
		<Popup open={open} close={close} title="Изменение меропрятия">
			{displayError(mutation)}
			{event.isLoading && <Spinner />}
			{mutation.isLoading && <Spinner />}
			<Form onSubmit={() =>
			{
				const title = inp_title.current?.value;
				const date = inp_date.current?.value;
				if (title && date)
					mutation.mutate({ date: date, name: title });
			}}>
				<FormField label="Название">
					<input ref={inp_title} type="text" required defaultValue={event.data?.name} />
				</FormField>
				<FormField label="Дата">
					<input ref={inp_date} type="datetime-local" required defaultValue={event.data?.date.toISOString().slice(0, -5)} />
				</FormField>
				<button type="submit" className="button button_small">Подтвердить</button>
			</Form>
		</Popup>
	);
}

interface EditEventFormProps extends PopupProps
{
	eventId: number | string,
}
