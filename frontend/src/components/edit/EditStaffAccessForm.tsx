import { useEvents } from "../../api/events";
import { useMutationStaffAccess } from "../../api/staff";
import { type StaffMember } from "../../api/user";
import { dateToString } from "../../utils/dates";
import displayError from "../../utils/displayError";
import useStateObj, { useStateList } from "../../utils/useStateObj";
import { Form } from "../Form";
import { EmptyState, matchesSearch, SearchField } from "../Page";
import Popup from "../Popup";
import Spinner from "../Spinner";

export default function EditStaffAccessForm({ member, close }: { member: StaffMember, close: () => void })
{
	const events = useEvents();
	const selected = useStateList(member.access || []);
	const search = useStateObj("");
	const mutation = useMutationStaffAccess(member.id, close);
	const disabled = mutation.isPending || !events.isSuccess;
	const filtered = events.data?.filter(event => matchesSearch(event.name, search.v)).sort((a, b) => b.date.getTime() - a.date.getTime());

	return <Popup title={`Доступ · ${member.name}`} open close={close}>
		{displayError(events)}{displayError(mutation)}{(events.isLoading || mutation.isPending) && <Spinner />}
		<Form disabled={disabled} onSubmit={() => mutation.mutate(selected.v)}>
			<SearchField value={search.v} onChange={search.set} placeholder="Название мероприятия" />
			{filtered?.map(event => <label className="check-label" key={event.id}>
				<input type="checkbox" checked={selected.v.includes(event.id)} disabled={disabled} onChange={e => selected.set(previous => e.target.checked ? [...previous, event.id] : previous.filter(id => id != event.id))} />
				<span>{event.name}<div className="muted">{dateToString(event.date)}</div></span>
			</label>)}
			{filtered?.length == 0 && <EmptyState>{events.data?.length ? "Ничего не найдено" : "Нет доступных мероприятий"}</EmptyState>}
			<div className="form-actions"><button type="button" className="button" onClick={close}>Отмена</button><button type="submit" className="button button_primary" disabled={disabled}>Сохранить</button></div>
		</Form>
	</Popup>;
}
