import { Link } from "react-router-dom";
import type { EventData } from "../../../api/events";
import { eventDateRange } from "../../../utils/multiday";
import styles from "./styles.module.css";

export default function ScannerHeader({ event, onInputBtn, operation = "entry" }: { event: EventData, onInputBtn: () => void, operation?: "entry" | "merch" })
{
	return <header className={styles.root}>
		<div><Link to="/">← Мероприятия</Link><h1>{event.name} · {operation == "merch" ? "Мерч" : "Вход"}</h1><p className="muted">{eventDateRange(event)}</p><Link to={`/scanner/${event.id}${operation == "entry" ? "/merch" : ""}`}>{operation == "entry" ? "Перейти к выдаче мерча" : "Перейти ко входу"}</Link></div>
		<button className="button button_primary" onClick={onInputBtn}>Ручной ввод</button>
	</header>;
}
