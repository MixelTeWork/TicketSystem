import { Link } from "react-router-dom";
import type { EventData } from "../../../api/events";
import { eventDateRange } from "../../../utils/multiday";
import styles from "./styles.module.css";
import BugReportButton from "../../../components/BugReportButton";

export default function ScannerHeader({ event, onInputBtn, onReportOpenChange, operation = "entry" }: { event: EventData, onInputBtn: () => void, onReportOpenChange: (open: boolean) => void, operation?: "entry" | "merch" })
{
	return <header className={styles.root}>
		<div className={styles.meta}><Link to="/">← Мероприятия</Link><p>{eventDateRange(event)}</p></div>
		<div className={styles.heading}>
			<h1><span className={styles.name} title={event.name}>{event.name}</span><span className={styles.operation}>· {operation == "merch" ? "Мерч" : "Вход"}</span></h1>
			<button className={`button button_primary ${styles.inputButton}`} onClick={onInputBtn}>Ручной ввод</button>
		</div>
		<div className={styles.links}><Link to={`/scanner/${event.id}${operation == "entry" ? "/merch" : ""}`}>{operation == "entry" ? "Перейти к выдаче мерча" : "Перейти ко входу"}</Link><BugReportButton className={styles.reportButton} iconOnly onOpenChange={onReportOpenChange} /></div>
	</header>;
}
