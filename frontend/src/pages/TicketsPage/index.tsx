import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, type Ticket } from "../../api/dataTypes";
import { useEvent } from "../../api/events";
import { useHasPermission } from "../../api/operations";
import { emptyTicketFilters, useTicketPage, type TicketFilters } from "../../api/tickets";
import Icon from "../../components/Icon";
import Layout from "../../components/Layout";
import { DataTable, EmptyState, PageHeading, Pagination, SearchField } from "../../components/Page";
import Spinner from "../../components/Spinner";
import ViewTicket from "../../components/ViewTicket";
import CreateTicketForm from "../../components/create/CreateTicketForm";
import EditTicketForm from "../../components/edit/EditTicketForm";
import { dateToString } from "../../utils/dates";
import displayError from "../../utils/displayError";
import useStateBool from "../../utils/useStateBool";
import useStateObj from "../../utils/useStateObj";
import { useTitle } from "../../utils/useTitle";
import styles from "./styles.module.css";

export default function TicketsPage()
{
	const eventId = useParams()["eventId"]!;
	return <TicketList key={eventId} eventId={eventId} />;
}

function TicketList({ eventId }: { eventId: string })
{
	const createFormOpen = useStateBool(false);
	const ticketOpen = useStateObj<Ticket | null>(null);
	const editFormOpen = useStateObj<Ticket | null>(null);
	const wide = useStateBool(false);
	const draft = useStateObj<TicketFilters>(emptyTicketFilters);
	const filters = useStateObj<TicketFilters>(emptyTicketFilters);
	const page = useStateObj(1);
	const pageSize = useStateObj("25");
	const navigate = useNavigate();
	const event = useEvent(eventId);
	const tickets = useTicketPage(eventId, filters.v, page.v, pageSize.v);
	const lastPage = useStateObj(tickets.data);
	const hasAddPermission = useHasPermission("add_ticket");
	const hasEditPermission = useHasPermission("change_ticket");
	useTitle([event.data?.name, "Билеты"]);

	useEffect(() =>
	{
		if (event.error instanceof ApiError && event.error.status == 404)
			navigate("/not_found", { replace: true });
	}, [event.error, navigate]);

	useEffect(() =>
	{
		const setLastPage = lastPage.set;
		if (tickets.data && !tickets.isPlaceholderData) setLastPage(tickets.data);
	}, [tickets.data, tickets.isPlaceholderData, lastPage.set]);
	useEffect(() =>
	{
		const setPage = page.set;
		if (tickets.isSuccess && !tickets.isFetching && !tickets.isPlaceholderData && tickets.data.page != page.v)
			setPage(tickets.data.page);
	}, [tickets.data, tickets.isSuccess, tickets.isFetching, tickets.isPlaceholderData, page.v, page.set]);
	const inaccessible = tickets.error instanceof ApiError && [401, 403, 404].includes(tickets.error.status ?? 0);
	const data = inaccessible ? undefined : tickets.data ?? lastPage.v;
	const actionsDisabled = tickets.isFetching || tickets.isError;
	const update = (values: Partial<TicketFilters>) => draft.set(previous => ({ ...previous, ...values }));
	const apply = () =>
	{
		if (tickets.isFetching) return;
		const next = { ...draft.v, search: draft.v.search.trim() };
		if (page.v == 1 && JSON.stringify(next) == JSON.stringify(filters.v)) void tickets.refetch();
		filters.set(next);
		page.set(1);
	};
	const reset = () => { draft.set(emptyTicketFilters); filters.set(emptyTicketFilters); page.set(1); };
	const start = data?.count ? data.pageSize == "all" ? 1 : (data.page - 1) * Number(data.pageSize) + 1 : 0;
	const backLink = `/events/${eventId}`;

	return <Layout backLink={backLink} centeredPage wide={wide.v} className={styles.root}>
		<PageHeading title={`Билеты · ${event.data?.name || "Мероприятие"}`} description={event.data ? dateToString(event.data.date) : undefined}>
			<button className="button" aria-pressed={wide.v} onClick={wide.toggle}>{wide.v ? "Свернуть до 800 px" : "На всю ширину"}</button>
			<Link target="_blank" to={`/events/${eventId}/print_tickets`} className="button">Печатный список</Link>
			{hasAddPermission && <button className="button button_primary" onClick={createFormOpen.setT}>＋ Добавить</button>}
		</PageHeading>
		<form className="toolbar" onSubmit={e => { e.preventDefault(); apply(); }}>
			<SearchField value={draft.v.search} onChange={search => update({ search })} maxLength={256} placeholder="Имя, код билета или промокод" />
			<label>Тип<select aria-label="Тип" value={draft.v.typeId} onChange={e => update({ typeId: e.target.value })}><option value="">Все</option>{data?.types.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
			<label>Промокод<select aria-label="Промокод" value={draft.v.noPromocode ? "none" : draft.v.promocode ? `promo:${draft.v.promocode}` : ""} onChange={e => update({ noPromocode: e.target.value == "none", promocode: e.target.value.startsWith("promo:") ? e.target.value.slice(6) : "" })}>
				<option value="">Все</option><option value="none">Без промокода</option>{data?.promocodes.map(promo => <option key={promo} value={`promo:${promo}`}>{promo}</option>)}
			</select></label>
			{data?.hasAuth && <label>В игре<select aria-label="В игре" value={draft.v.auth} onChange={e => update({ auth: e.target.value })}><option value="all">Все</option><option value="yes">Да</option><option value="no">Нет</option></select></label>}
			<div className="date-range"><label>Добавлен с<input type="date" value={draft.v.dateFrom} max={draft.v.dateTo || undefined} onChange={e => update({ dateFrom: e.target.value })} /></label><label>По<input type="date" value={draft.v.dateTo} min={draft.v.dateFrom || undefined} onChange={e => update({ dateTo: e.target.value })} /></label></div>
			<button type="submit" className="button button_primary" disabled={tickets.isFetching}>Применить</button>
			<button type="button" className="button" disabled={tickets.isFetching} onClick={reset}>Сбросить</button>
		</form>
		{(event.isLoading || tickets.isLoading) && <Spinner />}
		{displayError(event)}
		{displayError(tickets)}
		{tickets.isError && <div className="actions">{data && <span className="muted">Показаны последние успешно загруженные данные</span>}<button className="button" disabled={tickets.isFetching} onClick={() => tickets.refetch()}>Повторить загрузку</button></div>}
		{data && <DataTable className={styles.table} scrollable={false} busy={tickets.isFetching} columns={["162px", 45, "48px", 25, { weight: 15, minWidth: 86 }, 15, "32px", ...(data.hasAuth ? ["32px"] : []), "48px", ...(hasEditPermission ? ["40px"] : [])]} footer={<>
			<span role="status">{data.count ? `${start}–${start + data.items.length - 1} из ${data.count}` : "Ничего не найдено"} · Всего {data.total}</span>
			<div className="pagination"><label>Строк: <select value={pageSize.v} disabled={tickets.isFetching} onChange={e => { pageSize.set(e.target.value); page.set(1); }}><option>25</option><option>50</option><option>100</option><option value="all">Все</option></select></label>
				<Pagination page={data.page} pages={data.pages} disabled={actionsDisabled} onChange={page.set} />
			</div>
		</>}>
			<thead><tr><th>Код</th><th>Посетитель</th><th className={styles.center} title="Дата добавления" aria-label="Дата добавления"><Icon icon="note_add" /></th><th>Тип</th><th className={styles.promocode}>Промокод</th><th>Цена</th><th className={styles.center} title="Билет использован" aria-label="Билет использован"><Icon icon="login" /></th>{data.hasAuth && <th className={styles.center} title="Вошёл в игру" aria-label="Вошёл в игру"><Icon icon="stadia_controller" /></th>}<th className={styles.center}>Билет</th>{hasEditPermission && <th className={styles.center}>Ред.</th>}</tr></thead>
			<tbody>{data.items.map(ticket => <tr key={ticket.id}>
				<td className="code">{ticket.code}</td>
				<td>{ticket.personLink ? <a href={safePersonLink(ticket.personLink)} target="_blank" rel="noopener noreferrer">{ticket.personName}</a> : ticket.personName}</td>
				<td className={styles.center} title={dateToString(ticket.createdDate)}>{dateToString(ticket.createdDate, true, false)}</td>
				<td className={ticket.type.startsWith("<Удалён>") ? "muted" : ""}>{ticket.type}</td>
				<td>{ticket.promocode || "—"}</td>
				<td>{ticket.price == null ? "—" : `${ticket.price.toLocaleString("ru")} ₽`}</td>
				<td className={`${styles.center} ${ticket.scanned ? "success-text" : "muted"}`} aria-label={ticket.scanned ? "Использован" : "Не использован"}>{ticket.scanned ? "✓" : "✖"}</td>
				{data.hasAuth && <td className={`${styles.center} ${ticket.authOnPltf ? "success-text" : "muted"}`}>{ticket.authOnPltf ? "✓" : "✖"}</td>}
				<td className={styles.center}><button className="row-action" disabled={actionsDisabled} onClick={() => ticketOpen.set(ticket)}>Билет</button></td>
				{hasEditPermission && <td className={styles.center}><button className="row-action" disabled={actionsDisabled} aria-label={`Редактировать билет ${ticket.code}`} onClick={() => editFormOpen.set(ticket)}>Ред.</button></td>}
			</tr>)}
			{data.count == 0 && <tr><td colSpan={8 + Number(data.hasAuth) + Number(hasEditPermission)}><EmptyState /></td></tr>}
			</tbody>
		</DataTable>}
		<CreateTicketForm eventId={eventId} open={createFormOpen.v} close={createFormOpen.setF} setTicket={ticketOpen.set} />
		{event.data && <ViewTicket ticket={ticketOpen.v} event={event.data} close={() => ticketOpen.set(null)} />}
		<EditTicketForm ticket={editFormOpen.v} eventId={eventId} close={() => editFormOpen.set(null)} setTicket={ticketOpen.set} />
	</Layout>;
}

function safePersonLink(value: string)
{
	try { const url = new URL(value, window.location.href); return ["http:", "https:"].includes(url.protocol) ? url.href : "#"; }
	catch { return "#"; }
}
