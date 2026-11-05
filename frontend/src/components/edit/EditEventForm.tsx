import { useEffect, useRef } from "react";
import { useEvent, useMutationUpdateEvent } from "../../api/events";
import { EVENT_DATE_MAX, EVENT_DATE_MIN } from "../../utils/dates";
import displayError from "../../utils/displayError";
import useStateObj from "../../utils/useStateObj";
import { Form, FormField } from "../Form";
import Popup, { type PopupProps } from "../Popup";
import Spinner from "../Spinner";
import { calendarDate, eventEndDate } from "../../utils/multiday";

export default function EditEventForm({ eventId, open, close }: EditEventFormProps)
{
	const draft = useStateObj({ name: "", date: "", active: false, twoDays: false });
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
			setDraft({ name: event.data.name, date: event.data.date, active: event.data.active, twoDays: event.data.dayCount == 2 });
			initializedFor.current = String(eventId);
		}
	}, [open, eventId, event.isSuccess, event.data, reset, draft.set]);

	const busy = mutation.isPending || !event.isSuccess;
	const endDate = eventEndDate(draft.v.date, draft.v.twoDays);
	const update = (values: Partial<typeof draft.v>) => draft.set(previous => ({ ...previous, ...values }));

	return (
		<Popup open={open} close={close} title="Изменение мероприятия">
			{displayError(event)}
			{displayError(mutation)}
			{event.isLoading && <Spinner />}
			{mutation.isPending && <Spinner />}
			<Form disabled={busy} onSubmit={() =>
			{
				const { name, date, active, twoDays } = draft.v;
				if (name && endDate)
					mutation.mutate({ date, name, active, twoDays });
			}}>
				<FormField label="Название">
					<input value={draft.v.name} onChange={e => update({ name: e.target.value })} type="text" required disabled={busy} />
				</FormField>
				<FormField label="Дата (МСК)">
					<input value={draft.v.date} onChange={e => update({ date: e.target.value })} type="date" min={EVENT_DATE_MIN} max={EVENT_DATE_MAX} required disabled={busy} />
				</FormField>
				<label className="check-label"><input checked={draft.v.twoDays} onChange={e => update({ twoDays: e.target.checked })} type="checkbox" disabled={busy} /><span>Мероприятие на два дня</span></label>
				{draft.v.twoDays && <p className={draft.v.date && !endDate ? "danger-text" : "muted"} role={draft.v.date && !endDate ? "alert" : "status"}>{endDate ? `Окончание: ${calendarDate(endDate, true)} (МСК)` : draft.v.date ? "Выберите допустимую дату начала: оба дня должны быть не позднее 31.12.9999." : "Выберите дату начала — окончание рассчитается автоматически."}</p>}
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
