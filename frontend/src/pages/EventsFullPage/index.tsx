import { Fragment } from "react";
import { useEventsFull, useMutationGetAccessToEvent } from "../../api/events";
import useUser from "../../api/user";
import Layout from "../../components/Layout";
import { DataTable, EmptyState, matchesSearch, PageHeading, SearchField } from "../../components/Page";
import Spinner from "../../components/Spinner";
import { dateToString } from "../../utils/dates";
import displayError from "../../utils/displayError";
import useStateObj, { useStateObjNull } from "../../utils/useStateObj";
import { useTitle } from "../../utils/useTitle";

export default function EventsFullPage()
{
	useTitle("Все мероприятия");
	const user = useUser();
	const events = useEventsFull();
	const getAccess = useMutationGetAccessToEvent();
	const search = useStateObj("");
	const expanded = useStateObjNull<number>();
	const filtered = events.data?.filter(event => matchesSearch(`${event.id} ${event.name} ${dateToString(event.date)}`, search.v));
	return <Layout backLink="/d" centeredPage>
		<PageHeading title="Все мероприятия" />
		<div className="toolbar"><SearchField value={search.v} onChange={search.set} placeholder="ID, название или дата" /></div>
		{(events.isFetching || getAccess.isPending) && <Spinner />}{displayError(events)}{displayError(getAccess)}
		{events.isSuccess && <DataTable><thead><tr><th>ID</th><th>Дата</th><th>Мероприятие</th><th>Статус</th><th>Доступ</th></tr></thead><tbody>
			{filtered?.map(event => <Fragment key={event.id}><tr>
				<td className="code">{event.id}</td><td>{dateToString(event.date)}</td><td>{event.name}</td>
				<td><span className={event.active ? "success-text" : "muted"}>{event.active ? "Активно" : "Неактивно"}</span> {event.deleted && <span className="badge danger-text">Удалено</span>}</td>
				<td><button className="row-action" aria-expanded={expanded.v == event.id} aria-controls={`event-access-${event.id}`} onClick={() => expanded.set(expanded.v == event.id ? null : event.id)}>Доступы ({event.access.length})</button></td>
			</tr>{expanded.v == event.id && <tr id={`event-access-${event.id}`}><td colSpan={5}>
				{event.access.map(member => <p key={member.id}><code>{member.login}</code> <span className="muted">[{member.id}]</span> · {member.name}</p>)}
				{!event.access.some(member => member.id == user.data?.id) && <button className="button button_small" disabled={getAccess.isPending} onClick={() => getAccess.mutate(event.id)}>Get access</button>}
			</td></tr>}</Fragment>)}
			{filtered?.length == 0 && <tr><td colSpan={5}><EmptyState /></td></tr>}
		</tbody></DataTable>}
	</Layout>;
}
