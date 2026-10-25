import { useEffect, useRef } from "react";
import { useEvent, useMutationUpdateEvent } from "../../api/events";
import { datetimeToInput, EVENT_DATE_MAX, EVENT_DATE_MIN, inputToUtc } from "../../utils/dates";
import displayError from "../../utils/displayError";
import useStateObj from "../../utils/useStateObj";
import { Form, FormField } from "../Form";
import Popup, { type PopupProps } from "../Popup";
import Spinner from "../Spinner";

export default function EditEventForm({ eventId, open, close }: EditEventFormProps)
{
	const draft = useStateObj({ name: "", date: "", active: false });
	const mutation = useMutationUpdateEvent(eventId, close);
	const event = useEvent(eventId);
	const initializedFor = useRef<string | null>(null);
	const { reset } = mutation;

	useEffect(() =>
	{
		const setDraft = draft.set;
		if (!open)
		{
			initializedFor.current = null;
			reset();
		}
		else if (event.isSuccess && initializedFor.current != String(eventId))
		{
			setDraft({ name: event.data.name, date: datetimeToInput(event.data.date), active: event.data.active });
			initializedFor.current = String(eventId);
		}
	}, [open, eventId, event.isSuccess, event.data, reset, draft.set]);

	const busy = mutation.isPending || !event.isSuccess;
	const update = (values: Partial<typeof draft.v>) => draft.set(previous => ({ ...previous, ...values }));

	return (
		<Popup open={open} close={close} title="Изменение меропрятия">
			{displayError(event)}
			{displayError(mutation)}
			{event.isLoading && <Spinner />}
			{mutation.isPending && <Spinner />}
			<Form disabled={busy} onSubmit={() =>
			{
				const { name, date, active } = draft.v;
				if (name && date)
					mutation.mutate({ date: inputToUtc(date), name, active });
			}}>
				<FormField label="Название">
					<input value={draft.v.name} onChange={e => update({ name: e.target.value })} type="text" required disabled={busy} />
				</FormField>
				<FormField label="Дата (МСК)">
					<input value={draft.v.date} onChange={e => update({ date: e.target.value })} type="datetime-local" step="1" min={EVENT_DATE_MIN} max={EVENT_DATE_MAX} required disabled={busy} />
				</FormField>
				<label className="check-label">
					<input checked={draft.v.active} onChange={e => update({ active: e.target.checked })} type="checkbox" disabled={busy} />
					<span>Разрешить сканирование</span>
				</label>
				<button type="submit" className="button button_small" disabled={busy}>Подтвердить</button>
			</Form>
		</Popup>
	);
}

interface EditEventFormProps extends PopupProps
{
	eventId: number | string,
}
