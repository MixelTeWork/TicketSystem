import { Link } from "react-router-dom";
import { type EventData } from "../../../api/dataTypes";
import { datetimeToString } from "../../../utils/dates";
import styles from "./styles.module.css";

export default function ScannerHeader({ event, onInputBtn }: { event: EventData, onInputBtn: () => void })
{
	return <header className={styles.root}>
		<div><Link to="/">← Мероприятия</Link><h1>{event.name}</h1><p className="muted">{datetimeToString(event.date)}</p></div>
		<button className="button button_primary" onClick={onInputBtn}>Ручной ввод</button>
	</header>;
}
