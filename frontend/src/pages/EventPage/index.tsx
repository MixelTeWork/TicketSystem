import { Link, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import styles from "./styles.module.css"
import useEvents from "../../api/events";
import { dateToString } from "../../utils/dates";
import useTicketTypes from "../../api/ticketTypes";

export default function EventPage()
{
	const urlParams = useParams();
	const eventId = parseInt(urlParams["eventId"]!, 10);
	const events = useEvents();
	const event = events.data?.find(e => e.id == eventId);
	const ticketTypes = useTicketTypes(eventId);

	return (
		<>
			{events.isLoading && <Layout centered>Загрузка</Layout>}
			{events.isError && <Layout centered>Ошибка</Layout>}
			{event &&
				<Layout centeredPage gap="1rem">
					<h1>Мероприятие: {event.name}</h1>
					<div className={styles.card}>
						<div className={styles.card__header}>
							<h2>Мероприятие</h2>
							<button className="button" onClick={() => alert("Пока не работает")}>Редактировать</button>
						</div>
						<div className={styles.card__body}>
							<div>Название: {event.name}</div>
							<div>Дата проведения: {dateToString(event.date)}</div>
						</div>
					</div>
					<div className={styles.card}>
						<div className={styles.card__header}>
							<h2>Виды билетов</h2>
							<button className="button" onClick={() => alert("Пока не работает")}>Редактировать</button>
						</div>
						<div className={styles.card__body}>
							{ticketTypes.isLoading && <div>Загрузка</div>}
							{ticketTypes.isError && <div>Ошибка</div>}
							{ticketTypes.data?.map(v => <div key={v.id}>{v.name}</div>)}
						</div>
					</div>
					<button className="button" onClick={() => alert("Пока не работает")}>Добавить билет</button>
					<Link to={`/events/${eventId}/tickets`} className="button">Список билетов</Link>
					<div className={styles.gap}></div>
					<div className={styles.right}>
						<button className="button" onClick={() => alert("Пока не работает")}>Удалить</button>
					</div>
				</Layout>
			}
		</>
	);
}
