import { Link, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import styles from "./styles.module.css"
import { useEvent } from "../../api/events";
import { dateToString } from "../../utils/dates";
import useTicketTypes from "../../api/ticketTypes";

export default function EventPage()
{
	const urlParams = useParams();
	const eventId = urlParams["eventId"]!;
	const event = useEvent(eventId);
	const ticketTypes = useTicketTypes(eventId);

	return (
		<>
			{event.isLoading && <Layout centered>Загрузка</Layout>}
			{event.isError && <Layout centered>Ошибка</Layout>}
			{event.data &&
				<Layout centeredPage gap="1rem">
					<h1>Мероприятие: {event.data.name}</h1>
					<div className={styles.card}>
						<div className={styles.card__header}>
							<h2>Мероприятие</h2>
							<button className="button" onClick={() => alert("Пока не работает")}>Редактировать</button>
						</div>
						<div className={styles.card__body}>
							<div>Название: {event.data.name}</div>
							<div>Дата проведения: {dateToString(event.data.date)}</div>
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
					<Link to={`/scanner/${eventId}`} className="button">Ссылка на сканер</Link>
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
