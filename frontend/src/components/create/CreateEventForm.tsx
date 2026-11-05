import { useEffect, useRef } from "react";
import { useMutationNewEvent } from "../../api/events";
import { EVENT_DATE_MAX, EVENT_DATE_MIN } from "../../utils/dates";
import displayError from "../../utils/displayError";
import { Form, FormField } from "../Form";
import Popup, { type PopupProps } from "../Popup";
import Spinner from "../Spinner";
import useStateBool from "../../utils/useStateBool";
import useStateObj from "../../utils/useStateObj";
import { calendarDate, eventEndDate } from "../../utils/multiday";

export default function CreateEventForm({ open, close }: PopupProps)
{
	const inp_title = useRef<HTMLInputElement>(null);
	const date = useStateObj("");
	const mutation = useMutationNewEvent(close);
	const twoDays = useStateBool(false);
	const endDate = eventEndDate(date.v, twoDays.v);

	useEffect(() =>
	{
		const setTwoDays = twoDays.set;
		const setDate = date.set;
		if (!open)
		{
			setTwoDays(false);
			setDate("");
			if (inp_title.current) inp_title.current.value = "";
		}
	}, [open, twoDays.set, date.set]);

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
				if (title && endDate)
					mutation.mutate({ date: date.v, name: title, twoDays: twoDays.v });
			}}>
				<FormField label="Название">
					<input ref={inp_title} type="text" required />
				</FormField>
				<FormField label="Дата (МСК)">
					<input value={date.v} onChange={e => date.set(e.target.value)} type="date" min={EVENT_DATE_MIN} max={EVENT_DATE_MAX} required />
				</FormField>
				<label className="check-label"><input checked={twoDays.v} onChange={e => twoDays.set(e.target.checked)} type="checkbox" disabled={mutation.isPending} /><span>Мероприятие на два дня</span></label>
				{twoDays.v && <p className={date.v && !endDate ? "danger-text" : "muted"} role={date.v && !endDate ? "alert" : "status"}>{endDate ? `Окончание: ${calendarDate(endDate, true)} (МСК)` : date.v ? "Выберите допустимую дату начала: оба дня должны быть не позднее 31.12.9999." : "Выберите дату начала — окончание рассчитается автоматически."}</p>}
				<button type="submit" className="button button_small" disabled={mutation.isPending}>Создать</button>
			</Form>
			{mutation.isPending && <Spinner />}
		</Popup>
	);
}
