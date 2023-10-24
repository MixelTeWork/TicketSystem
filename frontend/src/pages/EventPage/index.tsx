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
import ApiError from "../../api/apiError";
import PopupConfirmDeletion from "../../components/PopupConfirmDeletion";
import displayError from "../../utils/displayError";
import { useStaffEvent } from "../../api/staff";
import EditStaffForm from "../../components/edit/EditStaffForm";

export default function EventPage()
{
	const [createFormOpen, setCreateFormOpen] = useState(false);
	const [deleteFormOpen, setDeleteFormOpen] = useState(false);
	const [editFormOpen, setEditFormOpen] = useState(false);
	const [editTypesFormOpen, setEditTypesFormOpen] = useState(false);
	const [editStaffOpen, setEditStaffOpen] = useState(false);
	const [ticketOpen, setTicketOpen] = useState<Ticket | null>(null);
	const navigate = useNavigate();
	const urlParams = useParams();
	const eventId = urlParams["eventId"]!;
	const event = useEvent(eventId);
	const ticketTypes = useTicketTypes(eventId);
	const staff = useStaffEvent(eventId);
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

					<Link to={`/scanner/${eventId}`} className="button">Ссылка на сканер</Link>

					{hasAddTicketPermission && <button className="button" onClick={() => setCreateFormOpen(true)}>Добавить билет</button>}
					<CreateTicketForm eventId={eventId} open={createFormOpen} close={() => setCreateFormOpen(false)} setTicet={setTicketOpen} />
					<ViewTicket ticket={ticketOpen} event={event.data} setTicket={setTicketOpen} />

					<Link to={`/events/${eventId}/tickets`} className="button">Список билетов</Link>

					<div className={styles.card}>
						<div className={styles.card__header}>
							<h2>Виды билетов</h2>
							{hasEditTypesPermission && <button className="button" onClick={() => setEditTypesFormOpen(true)}>Редактировать</button>}
							<EditTicketTypesForm eventId={eventId} open={editTypesFormOpen} close={() => setEditTypesFormOpen(false)} />
						</div>
						<div className={styles.card__body}>
							{ticketTypes.isLoading && <div>Загрузка</div>}
							{displayError(ticketTypes, error => <div>{error}</div>)}
							{ticketTypes.data?.map(v => <div key={v.id}>{v.name}</div>)}
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
