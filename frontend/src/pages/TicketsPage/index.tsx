import { useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import styles from "./styles.module.css"
import { useEvent } from "../../api/events";
import useTickets from "../../api/tickets";
import Popup from "../../components/Popup";
import ViewTicket from "./ViewTicket";
import { useState } from "react";
import { Ticket } from "../../api/dataTypes";
import { useTitle } from "../../utils/useTtile";
import Spinner from "../../components/Spinner";

export default function TicketsPage()
{
	const [ticketOpen, setTicketOpen] = useState<Ticket | null>(null);
	const urlParams = useParams();
	const eventId = urlParams["eventId"]!;
	const event = useEvent(eventId);
	const tickets = useTickets(eventId);
	useTitle([event.data?.name, "Билеты"]);

	return (
		<>
			{(event.isLoading || tickets.isLoading) && <Layout><Spinner/></Layout>}
			{(event.isError || tickets.isError) && <Layout centered>Ошибка</Layout>}
			{event.data && tickets.isSuccess &&
				<Layout centeredPage gap="1rem">
					<h1>Билеты: {event.data.name}</h1>
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
						<ViewTicket ticket={ticketOpen} event={event.data} />
					</Popup>
				</Layout>
			}
		</>
	);
}
