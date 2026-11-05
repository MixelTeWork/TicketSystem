import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../api/dataTypes";
import type { Ticket } from "../../api/tickets";
import { useEvent, useMutationDeleteEvent } from "../../api/events";
import { useHasPermission } from "../../api/operations";
import { useStaffEvent } from "../../api/staff";
import { useTicketStats } from "../../api/tickets";
import { useTicketTypes } from "../../api/ticketTypes";
import CreateTicketForm from "../../components/create/CreateTicketForm";
import EditEventForm from "../../components/edit/EditEventForm";
import EditStaffForm from "../../components/edit/EditStaffForm";
import EditTicketTypesForm from "../../components/edit/EditTicketTypesForm";
import Layout from "../../components/Layout";
import { CopyLink, DataTable, EmptyState, PageHeading, Section } from "../../components/Page";
import PopupConfirmDeletion from "../../components/PopupConfirmDeletion";
import PopupQrCode from "../../components/PopupQrCode";
import Spinner from "../../components/Spinner";
import TicketTypeEditor from "../../components/TicketEditor";
import ViewTicket from "../../components/ViewTicket";
import { eventDateRange } from "../../utils/multiday";
import EventStatistics, { EventTotals } from "../../components/EventStatistics";
import displayError from "../../utils/displayError";
import useStateBool from "../../utils/useStateBool";
import useStateObj from "../../utils/useStateObj";
import { useTitle } from "../../utils/useTitle";
import styles from "./styles.module.css";

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
	const eventId = useParams()["eventId"]!;
	const canAdd = useHasPermission("add_ticket");
	const canTypes = useHasPermission("change_ticket_types");
	const canEdit = useHasPermission("change_event");
	const canStaff = useHasPermission("get_staff_event");
	const canStaffEdit = useHasPermission("change_staff_event");
	const canDelete = useHasPermission("delete_event");
	const canScan = useHasPermission("scan_tickets");
	const event = useEvent(eventId);
	const ticketTypes = useTicketTypes(eventId);
	const staff = useStaffEvent(eventId, { enabled: canStaff });
	const stats = useTicketStats(eventId);
	const scannerLink = new URL(`/scanner/${eventId}`, window.location.href).href;
	useTitle(event.data?.name || "Мероприятие");

	useEffect(() =>
	{
		if (event.error instanceof ApiError && event.error.status == 404)
			navigate("/not_found", { replace: true });
	}, [event.error, navigate]);


	return <Layout backLink="/" centeredPage>
		{event.isLoading && <Spinner />}{displayError(event)}
		{event.data && <>
			<PageHeading title={event.data.name} description={eventDateRange(event.data)}>
				{canEdit && <button className="button" onClick={editFormOpen.setT}>Редактировать</button>}
			</PageHeading>
			{stats.data && <div className={styles.stats}><EventTotals rows={stats.data} event={event.data} /></div>}
			<div className="actions">
				<Link className="button" to={`/events/${eventId}/tickets`}>Список билетов</Link>
				{canAdd && <button className="button button_primary" onClick={createFormOpen.setT}>＋ Добавить билет</button>}
				{canScan && <><Link className="button" to={`/scanner/${eventId}`}>Сканер</Link><Link className="button" to={`/scanner/${eventId}/merch`}>Сканер мерча</Link><button className="button" onClick={() => qrcodeLinkOpen.set(scannerLink)}>QR-ссылка</button><CopyLink value={scannerLink} /></>}
			</div>
			<div className={styles.grid}>
				<Section title="Виды билетов" framed={false} actions={canTypes && <button className="button button_small" onClick={editTypesFormOpen.setT}>Редактировать</button>}>
					{(ticketTypes.isLoading || stats.isLoading) && <Spinner />}{displayError(ticketTypes)}{displayError(stats)}
					<EventStatistics className={styles.types} totalClassName={styles.total} event={event.data} rows={stats.data ?? []} types={ticketTypes.data ?? []} canEdit={canTypes} edit={editTypeFormOpen.set} />
				</Section>
				{canStaff && <Section title="Сотрудники" framed={false} actions={canStaffEdit && <button className="button button_small" onClick={editStaffOpen.setT}>Изменить доступ</button>}>
					{staff.isLoading && <Spinner />}{displayError(staff)}
					{staff.isSuccess && <DataTable><thead><tr><th>Имя</th><th>Роли</th></tr></thead><tbody>
						{staff.data.map(member => <tr key={member.id}><td>{member.name}</td><td>{member.roles.join(", ")}</td></tr>)}
						{staff.data.length == 0 && <tr><td colSpan={2}><EmptyState>Сотрудники не назначены</EmptyState></td></tr>}
					</tbody></DataTable>}
				</Section>}
			</div>
			{canDelete && <div className="danger-zone"><button className="button button_danger" onClick={deleteFormOpen.setT}>Удалить мероприятие</button></div>}
			<CreateTicketForm eventId={eventId} open={createFormOpen.v} close={createFormOpen.setF} setTicket={ticketOpen.set} />
			<ViewTicket ticket={ticketOpen.v} event={event.data} close={() => ticketOpen.set(null)} />
			<EditEventForm eventId={eventId} open={editFormOpen.v} close={editFormOpen.setF} />
			<EditTicketTypesForm event={event.data} eventId={eventId} open={editTypesFormOpen.v} close={editTypesFormOpen.setF} />
			<TicketTypeEditor typeId={editTypeFormOpen.v} eventId={parseInt(eventId)} open={editTypeFormOpen.v >= 0} close={() => editTypeFormOpen.set(-1)} />
			{canStaffEdit && <EditStaffForm eventId={eventId} open={editStaffOpen.v} close={editStaffOpen.setF} />}
			<PopupQrCode title="Ссылка на сканер" code={qrcodeLinkOpen.v} setCode={qrcodeLinkOpen.set} />
			<PopupConfirmDeletion mutationParams={undefined} title={`Удалить «${event.data.name}»?`} onSuccess={() => navigate("/")} mutationFn={useMutationDeleteEvent} itemId={eventId} open={deleteFormOpen.v} close={deleteFormOpen.setF} />
		</>}
	</Layout>;
}
