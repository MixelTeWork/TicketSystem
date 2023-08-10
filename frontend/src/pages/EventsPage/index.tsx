import { Link } from "react-router-dom";
import { useEvents } from "../../api/events";
import Layout from "../../components/Layout";
import styles from "./styles.module.css"
import classNames from "../../utils/classNames";
import { dateToString } from "../../utils/dates";
import { useTitle } from "../../utils/useTtile";
import CreateEventForm from "../../components/create/CreateEventForm";
import { useState } from "react";
import { useHasPermission } from "../../api/operations";

export default function EventsPage()
{
	useTitle("Мероприятия");
	const [createFormOpen, setCreateFormOpen] = useState(false);
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
			{useHasPermission("add_event") &&
				<div className={styles.space_between}>
					<span></span>
					<button className="button" onClick={() => setCreateFormOpen(true)}>Добавить</button>
				</div>
			}
			<CreateEventForm open={createFormOpen} close={() => setCreateFormOpen(false)} />
		</Layout>
	);
}
