import { Link } from "react-router-dom";
import { useEvents } from "../../api/events";
import { useHasPermission } from "../../api/operations";
import CreateEventForm from "../../components/create/CreateEventForm";
import Layout from "../../components/Layout";
import { DataTable, EmptyState, matchesSearch, PageHeading, SearchField, SectionLinks } from "../../components/Page";
import Spinner from "../../components/Spinner";
import { eventDateRange } from "../../utils/multiday";
import displayError from "../../utils/displayError";
import useStateBool from "../../utils/useStateBool";
import useStateObj from "../../utils/useStateObj";
import { useTitle } from "../../utils/useTitle";

export default function EventsPage()
{
	useTitle("Мероприятия");
	const createFormOpen = useStateBool(false);
	const search = useStateObj("");
	const canView = useHasPermission("page_events");
	const canScan = useHasPermission("scan_tickets");
	const canAdd = useHasPermission("add_event");
	const canStaff = useHasPermission("page_staff");
	const canFonts = useHasPermission("page_fonts");
	const canManagers = useHasPermission("page_managers");
	const canDebug = useHasPermission("page_debug");
	const events = useEvents({ staleTime: 0, enabled: canView || canScan });
	const filtered = events.data?.filter(e => matchesSearch(e.name + " " + eventDateRange(e) + " " + e.days.map(day => day.date).join(" "), search.v)).sort((a, b) => b.date.localeCompare(a.date));
	const links = [
		...(canStaff ? [{ title: "Сотрудники", to: "/staff" }] : []),
		...(canFonts ? [{ title: "Шрифты", to: "/fonts" }] : []),
		...(canManagers ? [{ title: "Организаторы", to: "/managers" }] : []),
		...(canDebug ? [{ title: "Администрирование", to: "/d" }] : []),
	];
	return <Layout centeredPage>
		<SectionLinks links={links} />
		<PageHeading title="Мероприятия">{canAdd && <button className="button button_primary" onClick={createFormOpen.setT}>＋ Добавить</button>}</PageHeading>
		{canView || canScan ? <>
			<div className="toolbar"><SearchField value={search.v} onChange={search.set} placeholder="Название или дата мероприятия" /></div>
			{events.isLoading && <Spinner />}
			{displayError(events)}
			{events.isSuccess && <DataTable>
				<thead><tr><th>Мероприятие</th><th>Дата</th>{canView && <th>Билеты</th>}<th>Действия</th></tr></thead>
				<tbody>{filtered?.map(event => <tr key={event.id}>
					<td>{canView ? <Link to={`/events/${event.id}`}>{event.name}</Link> : event.name}</td>
					<td>{eventDateRange(event)}</td>
					{canView && <td>{event.ticketCount ?? "—"}</td>}
					<td><div className="actions">
						{canView && <Link to={`/events/${event.id}/tickets`}>Билеты</Link>}
						{canScan && event.active && <><Link to={`/scanner/${event.id}`}>Сканер</Link><Link to={`/scanner/${event.id}/merch`}>Мерч</Link></>}
					</div></td>
				</tr>)}{filtered?.length == 0 && <tr><td colSpan={canView ? 4 : 3}><EmptyState>{search.v ? "Ничего не найдено" : "Нет доступных мероприятий"}</EmptyState></td></tr>}</tbody>
			</DataTable>}
		</> : <EmptyState>Выберите раздел</EmptyState>}
		<CreateEventForm open={createFormOpen.v} close={createFormOpen.setF} />
	</Layout>;
}
