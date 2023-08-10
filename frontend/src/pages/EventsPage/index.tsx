import { Link } from "react-router-dom";
import { useEvents } from "../../api/events";
import Layout from "../../components/Layout";
import styles from "./styles.module.css"
import classNames from "../../utils/classNames";
import { dateToString } from "../../utils/dates";
import { useTitle } from "../../utils/useTtile";

export default function EventsPage()
{
	useTitle("Мероприятия");
	const events = useEvents();

	return (
		<Layout centeredPage gap="1rem">
			<h1>Мероприятия</h1>
			{events.isLoading && <div>Загрузка</div>}
			{events.isError && <div>Ошибка</div>}
			{events.data?.map(e =>
				<Link
					to={`/events/${e.id}`}
					className={classNames("button button_large", styles.space_between)}
					key={e.id}
				>
					<span>{e.name}</span>
					<span>{dateToString(e.date)}</span>
				</Link>
			)}
			<div className={styles.space_between}>
				<span></span>
				<button className="button" onClick={() => alert("Пока не работает")}>Добавить</button>
			</div>
		</Layout>
	);
}
