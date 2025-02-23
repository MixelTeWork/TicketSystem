import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import styles from "./styles.module.css"
import { useEvent } from "../../api/events";
import useTickets from "../../api/tickets";
import ViewTicket from "../../components/ViewTicket";
import { useEffect, useState } from "react";
import { Ticket } from "../../api/dataTypes";
import { useTitle } from "../../utils/useTtile";
import Spinner from "../../components/Spinner";
import CreateTicketForm from "../../components/create/CreateTicketForm";
import { useHasPermission } from "../../api/operations";
import { ApiError } from "../../api/dataTypes";
import displayError from "../../utils/displayError";
import EditTicketForm from "../../components/edit/EditTicketForm";
import { dateToString } from "../../utils/dates";

export default function TicketsPage()
{
	const [createFormOpen, setCreateFormOpen] = useState(false);
	const [ticketOpen, setTicketOpen] = useState<Ticket | null>(null);
	const [editFormOpen, setEditFormOpen] = useState<Ticket | null>(null);
	const navigate = useNavigate();
	const urlParams = useParams();
	const eventId = urlParams["eventId"]!;
	const event = useEvent(eventId);
	const tickets = useTickets(eventId);
	const hasAddPermission = useHasPermission("add_ticket");
	const hasEditPermission = useHasPermission("change_ticket");
	useTitle([event.data?.name, "Билеты"]);

	useEffect(() =>
	{
		if (event.error instanceof ApiError && event.error.message.includes("not found"))
			navigate("/not_found", { replace: true });
	}, [event.error, navigate]);

	const showAuthOnPlt = tickets.data?.some(v => v.authOnPltf);
	const backLink = `/events/${eventId}`;

	return (
		<>
			{(event.isLoading || tickets.isLoading) && <Layout backLink={backLink}><Spinner /></Layout>}
			{displayError(event)}
			{displayError(tickets)}
			{event.data && tickets.isSuccess &&
				<Layout backLink={backLink} centeredH gap="1rem" padding="1rem">
					<h1>Билеты: {event.data.name}</h1>
					<div className={styles.right}>
						<Link target="_blank" to={`/events/${eventId}/print_tickets`} className="button">Распечатать</Link>
						{hasAddPermission && <button className="button" onClick={() => setCreateFormOpen(true)}>Добавить</button>}
						<CreateTicketForm eventId={eventId} open={createFormOpen} close={() => setCreateFormOpen(false)} setTicet={setTicketOpen} />
					</div>
					<table className={styles.table}>
						<thead>
							<tr>
								<th style={{ width: "10.5em" }}>Код</th>
								<th>Посетитель</th>
								<th style={{ width: "2.6em" }} title="Дата добавления"><span className="icon">note_add</span></th>
								<th>Тип билета</th>
								<th>Промокод</th>
								<th style={{ width: "1.4em" }} title="Билет использован"><span className="icon">login</span></th>
								{showAuthOnPlt && <th style={{ width: "1.4em" }} title="Вошёл в игру"><span className="icon">stadia_controller</span></th>}
								<th style={{ width: "3.2em" }}>Билет</th>
								{hasEditPermission && <th style={{ width: "2.3em" }}>Ред</th>}
							</tr>
						</thead>
						<tbody>
							{tickets.data?.map(v => <tr key={v.id}>
								<td>{v.code}</td>
								<td>
									{v.personLink ? <a href={v.personLink}>{v.personName}</a> : v.personName}
								</td>
								<td>{dateToString(v.createdDate, true, false)}</td>
								<td style={{ color: v.type.startsWith("<Удалён>") ? "red" : "" }}>{v.type}</td>
								<td>{v.promocode}</td>
								<td className={styles.center}>{v.scanned ? "✓" : "✖"}</td>
								{showAuthOnPlt && <td className={styles.center}>{v.authOnPltf ? "✓" : "✖"}</td>}
								<td className={styles.center}>
									<button className="button button_small" onClick={() => setTicketOpen(v)}>Билет</button>
								</td>
								{hasEditPermission &&
									<td className={styles.center}>
										<button className="button button_small" onClick={() => setEditFormOpen(v)}>Ред</button>
									</td>
								}
							</tr>)}
						</tbody>
					</table>
					<ViewTicket ticket={ticketOpen} event={event.data} close={() => setTicketOpen(null)} />
					<EditTicketForm ticket={editFormOpen} eventId={eventId} close={() => setEditFormOpen(null)} setTicket={setTicketOpen} />
				</Layout>
			}
		</>
	);
}
