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
import ApiError from "../../api/apiError";

export default function TicketsPage()
{
	const [createFormOpen, setCreateFormOpen] = useState(false);
	const [ticketOpen, setTicketOpen] = useState<Ticket | null>(null);
	const navigate = useNavigate();
	const urlParams = useParams();
	const eventId = urlParams["eventId"]!;
	const event = useEvent(eventId);
	const tickets = useTickets(eventId);
	const hasAddPermission = useHasPermission("add_ticket");
	useTitle([event.data?.name, "Билеты"]);

	useEffect(() =>
	{
		if (event.isError && event.error instanceof ApiError && event.error.message.includes("not found"))
			navigate("/not_found", { replace: true });
	}, [event.isError]);

	const backLink = `/events/${eventId}`;

	return (
		<>
			{(event.isLoading || tickets.isLoading) && <Layout backLink={backLink}><Spinner /></Layout>}
			{(event.isError || tickets.isError) && <Layout backLink={backLink} centered>Ошибка</Layout>}
			{event.data && tickets.isSuccess &&
				<Layout backLink={backLink} centeredPage gap="1rem">
					<h1>Билеты: {event.data.name}</h1>
					<div className={styles.right}>
						<Link target="_blank" to={`/events/${eventId}/print_tickets`} className="button">Распечатать</Link>
						{hasAddPermission && <button className="button" onClick={() => setCreateFormOpen(true)}>Добавить</button>}
						<CreateTicketForm eventId={eventId} open={createFormOpen} close={() => setCreateFormOpen(false)} setTicet={setTicketOpen} />
					</div>
					<table>
						<thead>
							<tr>
								<th style={{ width: "11em" }}>Код</th>
								<th>Посетитель</th>
								<th>Тип билета</th>
								<th>Промокод</th>
								<th><div>Исполь</div><div>зован</div></th>
								<th>Билет</th>
							</tr>
						</thead>
						<tbody>
							{tickets.data?.map(v => <tr key={v.id}>
								<td>{v.code}</td>
								<td>
									{v.personLink ? <a href={v.personLink}>{v.personName}</a> : v.personName}
								</td>
								<td style={{ color: v.type.startsWith("<Удалён>") ? "red" : "" }}>{v.type}</td>
								<td>{v.promocode}</td>
								<td className={styles.center}>{v.scanned ? "✓" : "✖"}</td>
								<td className={styles.center}>
									<button onClick={() => setTicketOpen(v)}>Билет</button>
								</td>
							</tr>)}
						</tbody>
					</table>
					<ViewTicket ticket={ticketOpen} event={event.data} setTicket={setTicketOpen} />
				</Layout>
			}
		</>
	);
}
