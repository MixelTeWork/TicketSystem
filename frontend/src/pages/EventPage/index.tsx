import useStateBool from "../../utils/useStateBool";
import useStateObj from "../../utils/useStateObj";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import styles from "./styles.module.css";
import { useEvent, useMutationDeleteEvent } from "../../api/events";
import { dateToString } from "../../utils/dates";
import { useTicketTypes } from "../../api/ticketTypes";
import { useTitle } from "../../utils/useTitle";
import Spinner from "../../components/Spinner";
import CreateTicketForm from "../../components/create/CreateTicketForm";
import { Fragment, useEffect } from "react";
import { useHasPermission } from "../../api/operations";
import ViewTicket from "../../components/ViewTicket";
import { type Ticket } from "../../api/dataTypes";
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
import Icon from "../../components/Icon";

export default function EventPage()
{
	const createFormOpen = useStateBool(false);
	const deleteFormOpen = useStateBool(false);
	const editFormOpen = useStateBool(false);
	const editTypesFormOpen = useStateBool(false);
	const editTypeFormOpen = useStateObj(-1);
	const editStaffOpen = useStateBool(false);
	const ticketOpen = useStateObj<Ticket | null>(null);
	const qrcodeLinkOpen = useStateObj("");

	const navigate = useNavigate();
	const urlParams = useParams();
	const eventId = urlParams["eventId"]!;

	const hasAddTicketPermission = useHasPermission("add_ticket");
	const hasEditTypesPermission = useHasPermission("change_ticket_types");
	const hasEditEventPermission = useHasPermission("change_event");
	const hasViewStaffPermission = useHasPermission("get_staff_event");
	const hasEditStaffPermission = useHasPermission("change_staff_event");
	const hasDeleteEventPermission = useHasPermission("delete_event");

	const event = useEvent(eventId);
	const ticketTypes = useTicketTypes(eventId);
	const staff = useStaffEvent(eventId, { enabled: hasViewStaffPermission });
	const stats = useTicketStats(eventId);

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
							{hasEditEventPermission && <button className="button" onClick={editFormOpen.setT}>Редактировать</button>}
							<EditEventForm eventId={eventId} open={editFormOpen.v} close={editFormOpen.setF} />
						</div>
						<div className={styles.card__body}>
							<div>Название: {event.data.name}</div>
							<div>Дата проведения: {dateToString(event.data.date)}</div>
						</div>
					</div>

					<div className={styles.line}>
						<Link to={`/scanner/${eventId}`} className="button">Ссылка на сканер</Link>
						<button className="button" onClick={() => qrcodeLinkOpen.set(new URL(`/scanner/${eventId}`, window.location.href).href)}>Qr код на сканер</button>
						<PopupQrCode title="Ссылка на сканер" code={qrcodeLinkOpen.v} setCode={qrcodeLinkOpen.set} />
					</div>

					{hasAddTicketPermission && <button className="button" onClick={createFormOpen.setT}>Добавить билет</button>}
					<CreateTicketForm eventId={eventId} open={createFormOpen.v} close={createFormOpen.setF} setTicket={ticketOpen.set} />
					<ViewTicket ticket={ticketOpen.v} event={event.data} close={() => ticketOpen.set(null)} />

					<Link to={`/events/${eventId}/tickets`} className="button">Список билетов</Link>

					<div className={styles.card}>
						<div className={styles.card__header}>
							<h2>Виды билетов</h2>
							{hasEditTypesPermission && <button className="button" onClick={editTypesFormOpen.setT}>Редактировать</button>}
							<EditTicketTypesForm eventId={eventId} open={editTypesFormOpen.v} close={editTypesFormOpen.setF} />
							<TicketTypeEditor typeId={editTypeFormOpen.v} eventId={parseInt(eventId)} open={editTypeFormOpen.v >= 0} close={() => editTypeFormOpen.set(-1)} />
						</div>
						<div className={styles.card__body}>
							{ticketTypes.isLoading && <div>Загрузка</div>}
							{displayError(ticketTypes, error => <div>{error}</div>)}
							<div className={styles.ticketTypes}>
								{ticketTypes.data?.map(v =>
									<Fragment key={v.id}>
										<div>
											<button
												className="button button_small button_icon"
												style={{ marginRight: "0.5em", color: v.pattern ? "green" : "" }}
												onClick={() => editTypeFormOpen.set(v.id)}
											><Icon icon="edit_square" /></button>
											<span>{v.name}</span>
										</div>
										{(() =>
										{
											if (!stats.data) return <><div></div><div></div><div></div></>;
											const data = stats.data?.find(s => s.typeId == v.id);
											const count = data?.count || 0;
											return <>
												<div>
													<Icon icon="group" />
													<span>{count}</span>
													<span> ({calcPercent(count || 0, stats_sum.count)}%)</span>
												</div>
												<div>
													<Icon icon="login" />
													<span>{data?.scanned || 0}</span>
													<span> ({calcPercent(data?.scanned || 0, count)}%)</span>
												</div>
												<div>
													{stats_sum.authOnPltf > 0 && <>
														<Icon icon="stadia_controller" />
														<span>{data?.authOnPltf || 0}</span>
														<span> ({calcPercent(data?.authOnPltf || 0, count)}%)</span>
													</>}
												</div>
											</>;
										})()}
									</Fragment>,
								)}
								{stats.data && <>
									<div style={{ fontWeight: "bold" }}>
										<span>Всего</span>
									</div>
									<div style={{ fontWeight: "bold" }}>
										<Icon icon="group" />
										<span>{stats_sum.count}</span>
									</div>
									<div style={{ fontWeight: "bold" }}>
										<Icon icon="login" />
										<span>{stats_sum.scanned}</span>
										<span> ({calcPercent(stats_sum.scanned, stats_sum.count)}%)</span>
									</div>
									<div style={{ fontWeight: "bold" }}>
										{stats_sum.authOnPltf > 0 && <>
											<Icon icon="stadia_controller" />
											<span>{stats_sum.authOnPltf}</span>
											<span> ({calcPercent(stats_sum.authOnPltf, stats_sum.count)}%)</span>
										</>}
									</div>
								</>}
							</div>
							{stats.isLoading && <div>Загрузка</div>}
							{displayError(stats, error => <div>{error}</div>)}
						</div>
					</div>
					{hasViewStaffPermission &&
						<div className={styles.card}>
							<div className={styles.card__header}>
								<h2>Клерки</h2>
								{hasEditStaffPermission && <button className="button" onClick={editStaffOpen.setT}>Редактировать</button>}
								<EditStaffForm eventId={eventId} open={editStaffOpen.v} close={editStaffOpen.setF} />
							</div>
							<div className={styles.card__body}>
								{staff.isLoading && <div>Загрузка</div>}
								{displayError(staff, error => <div>{error}</div>)}
								{staff.data?.map(v => <div key={v.id}>{v.name}</div>)}
							</div>
						</div>}
					<div className={styles.gap}></div>
					<div className={styles.right}>
						{hasDeleteEventPermission && <button className="button" onClick={deleteFormOpen.setT}>Удалить</button>}
					</div>
					<PopupConfirmDeletion title="Удаление меропрятия" onSuccess={() => navigate("/events")} mutationFn={useMutationDeleteEvent} itemId={eventId} open={deleteFormOpen.v} close={deleteFormOpen.setF} />
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
