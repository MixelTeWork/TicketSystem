import { useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import styles from "./styles.module.css"
import useEvents from "../../api/events";
import useTickets from "../../api/tickets";
import Popup from "../../components/Popup";
import ViewTicket from "./ViewTicket";
import { useState } from "react";
import { Ticket } from "../../api/dataTypes";
import classNames from "../../utils/classNames";

export default function TicketsPage()
{
	const [ticketOpen, setTicketOpen] = useState<Ticket | null>(null);
	const urlParams = useParams();
	const eventId = parseInt(urlParams["eventId"]!, 10);
	const events = useEvents();
	const event = events.data?.find(e => e.id == eventId);
	const tickets = useTickets(eventId);

	return (
		<>
			{events.isLoading && <Layout centered>Загрузка</Layout>}
			{events.isError && <Layout centered>Ошибка</Layout>}
			{event &&
				<Layout centeredPage gap="1rem">
					<h1>Билеты: {event.name}</h1>
					<div className={styles.right}>
						<button className="button" onClick={() => alert("Пока не работает")}>Распечатать</button>
						<button className="button" onClick={() => alert("Пока не работает")}>Добавить</button>
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
								<td>{v.personName}</td>
								<td>{v.type}</td>
								<td>{v.promocode}</td>
								<td className={styles.center}>{v.scanned ? "✓" : "✖"}</td>
								<td className={styles.center}>
									<button onClick={() => setTicketOpen(v)}>Билет</button>
								</td>
							</tr>)}
						</tbody>
					</table>
					<Popup open={!!ticketOpen} close={() => setTicketOpen(null)} title="Просмотр билета">
						<ViewTicket ticket={ticketOpen} event={event} />
					</Popup>
				</Layout>
			}
		</>
	);
}
