import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import styles from "./styles.module.css"
import { useEvent, useMutationDeleteEvent } from "../../api/events";
import { dateToString } from "../../utils/dates";
import { useTicketTypes } from "../../api/ticketTypes";
import { useTitle } from "../../utils/useTtile";
import Spinner from "../../components/Spinner";
import CreateTicketForm from "../../components/create/CreateTicketForm";
import { useEffect, useState } from "react";
import { useHasPermission } from "../../api/operations";
import ViewTicket from "../../components/ViewTicket";
import { Ticket } from "../../api/dataTypes";
import EditTicketTypesForm from "../../components/edit/EditTicketTypesForm";
import EditEventForm from "../../components/edit/EditEventForm";
import { ApiError } from "../../api/dataTypes";
import PopupConfirmDeletion from "../../components/PopupConfirmDeletion";
import displayError from "../../utils/displayError";
import { useStaffEvent } from "../../api/staff";
import EditStaffForm from "../../components/edit/EditStaffForm";
import PopupQrCode from "../../components/PopupQrCode";
import { useTicketStats } from "../../api/tickets";
import TicketTypeEditor from "../../components/TicketEditor";

export default function EventPage()
{
	const [createFormOpen, setCreateFormOpen] = useState(false);
	const [deleteFormOpen, setDeleteFormOpen] = useState(false);
	const [editFormOpen, setEditFormOpen] = useState(false);
	const [editTypesFormOpen, setEditTypesFormOpen] = useState(false);
	const [editTypeFormOpen, setEditTypeFormOpen] = useState(-1);
	const [editStaffOpen, setEditStaffOpen] = useState(false);
	const [ticketOpen, setTicketOpen] = useState<Ticket | null>(null);
	const [qrcodeLinkOpen, setQrcodeLinkOpen] = useState("");
	const navigate = useNavigate();
	const urlParams = useParams();
	const eventId = urlParams["eventId"]!;
	const event = useEvent(eventId);
	const ticketTypes = useTicketTypes(eventId);
	const staff = useStaffEvent(eventId);
	const stats = useTicketStats(eventId);
	const hasAddTicketPermission = useHasPermission("add_ticket");
	const hasEditTypesPermission = useHasPermission("change_ticket_types");
	const hasEditEventPermission = useHasPermission("change_event");
	const hasViewStaffPermission = useHasPermission("get_staff_event");
	const hasEditStaffPermission = useHasPermission("change_staff_event");
	const hasDeleteEventPermission = useHasPermission("delete_event");
	useTitle(event.data?.name || "Мероприятие");

	useEffect(() =>
	{
		if (event.error instanceof ApiError && event.error.message.includes("not found"))
			navigate("/not_found", { replace: true });
	}, [event.error, navigate]);

	const backLink = "/events";
	const stats_sum = (stats.data || []).reduce((p, v) =>
	{
		p.count += v.count;
		p.scanned += v.scanned;
		p.authOnPltf += v.authOnPltf;
		return p;
	}, {
		count: 0,
		scanned: 0,
		authOnPltf: 0,
	});

	return (
		<>
			{event.isLoading && <Layout backLink={backLink}><Spinner /></Layout>}
			{displayError(event, error => <Layout backLink={backLink} centered>{error}</Layout>)}
			{event.data &&
				<Layout backLink={backLink} centeredPage gap="1rem">
					<h1>Мероприятие: {event.data.name}</h1>
					<div className={styles.card}>
						<div className={styles.card__header}>
							<h2>Мероприятие</h2>
							{hasEditEventPermission && <button className="button" onClick={() => setEditFormOpen(true)}>Редактировать</button>}
							<EditEventForm eventId={eventId} open={editFormOpen} close={() => setEditFormOpen(false)} />
						</div>
						<div className={styles.card__body}>
							<div>Название: {event.data.name}</div>
							<div>Дата проведения: {dateToString(event.data.date)}</div>
						</div>
					</div>

					<div className={styles.line}>
						<Link to={`/scanner/${eventId}`} className="button">Ссылка на сканер</Link>
						<button className="button" onClick={() => setQrcodeLinkOpen(new URL(`/scanner/${eventId}`, window.location.href).href)}>Qr код на сканер</button>
						<PopupQrCode title="Ссылка на сканер" code={qrcodeLinkOpen} setCode={setQrcodeLinkOpen} />
					</div>

					{hasAddTicketPermission && <button className="button" onClick={() => setCreateFormOpen(true)}>Добавить билет</button>}
					<CreateTicketForm eventId={eventId} open={createFormOpen} close={() => setCreateFormOpen(false)} setTicet={setTicketOpen} />
					<ViewTicket ticket={ticketOpen} event={event.data} close={() => setTicketOpen(null)} />

					<Link to={`/events/${eventId}/tickets`} className="button">Список билетов</Link>

					<div className={styles.card}>
						<div className={styles.card__header}>
							<h2>Виды билетов</h2>
							{hasEditTypesPermission && <button className="button" onClick={() => setEditTypesFormOpen(true)}>Редактировать</button>}
							<EditTicketTypesForm eventId={eventId} open={editTypesFormOpen} close={() => setEditTypesFormOpen(false)} />
							<TicketTypeEditor typeId={editTypeFormOpen} eventId={parseInt(eventId)} open={editTypeFormOpen >= 0} close={() => setEditTypeFormOpen(-1)} />
						</div>
						<div className={styles.card__body}>
							{ticketTypes.isLoading && <div>Загрузка</div>}
							{displayError(ticketTypes, error => <div>{error}</div>)}
							{ticketTypes.data?.map(v =>
								<div key={v.id} className={styles.typeRow}>
									<button
										className="button button_small icon"
										style={{ marginRight: "0.5em", color: v.pattern ? "green" : "" }}
										onClick={() => setEditTypeFormOpen(v.id)}
									>edit_square</button>
									<span>{v.name}</span>
									<span>{" -> "}</span>
									{(() =>
									{
										const data = stats.data?.find(s => s.typeId == v.id);
										const count = data?.count || 0;
										return <>
											<span className="icon">group</span>
											<span>{count}</span>
											<span> ({calcPercent(count || 0, stats_sum.count)}%)</span>
											<span>   </span>
											<span className="icon">login</span>
											<span>{data?.scanned}</span>
											<span> ({calcPercent(data?.scanned || 0, count)}%)</span>
											{stats_sum.authOnPltf > 0 && <>
												<span>   </span>
												<span className="icon">stadia_controller</span>
												<span>{data?.authOnPltf}</span>
												<span> ({calcPercent(data?.authOnPltf || 0, count)}%)</span>
											</>}
										</>
									})()}
								</div>
							)}
							{stats.isLoading && <div>Загрузка</div>}
							{displayError(stats, error => <div>{error}</div>)}
							{stats.data &&
								<div style={{ fontWeight: "bold" }} className={styles.typeRow}>
									<span>{"Всего -> "}</span>
									<span className="icon">group</span>
									<span>{stats_sum.count}</span>
									<span>   </span>
									<span className="icon">login</span>
									<span>{stats_sum.scanned}</span>
									<span> ({calcPercent(stats_sum.scanned, stats_sum.count)}%)</span>
									{stats_sum.authOnPltf > 0 && <>
										<span>   </span>
										<span className="icon">stadia_controller</span>
										<span>{stats_sum.authOnPltf}</span>
										<span> ({calcPercent(stats_sum.authOnPltf, stats_sum.count)}%)</span>
									</>}
								</div>
							}
						</div>
					</div>
					{hasViewStaffPermission &&
						<div className={styles.card}>
							<div className={styles.card__header}>
								<h2>Клерки</h2>
								{hasEditStaffPermission && <button className="button" onClick={() => setEditStaffOpen(true)}>Редактировать</button>}
								<EditStaffForm eventId={eventId} open={editStaffOpen} close={() => setEditStaffOpen(false)} />
							</div>
							<div className={styles.card__body}>
								{staff.isLoading && <div>Загрузка</div>}
								{displayError(staff, error => <div>{error}</div>)}
								{staff.data?.map(v => <div key={v.id}>{v.name}</div>)}
							</div>
						</div>}
					<div className={styles.gap}></div>
					<div className={styles.right}>
						{hasDeleteEventPermission && <button className="button" onClick={() => setDeleteFormOpen(true)}>Удалить</button>}
					</div>
					<PopupConfirmDeletion title="Удаление меропрятия" onSuccess={() => navigate("/events")} mutationFn={useMutationDeleteEvent} itemId={eventId} open={deleteFormOpen} close={() => setDeleteFormOpen(false)} />
				</Layout>
			}
		</>
	);
}

function calcPercent(v: number, all: number)
{
	if (all == 0) return 0;
	return Math.floor(v / all * 100);
}
