import { EventData } from "../../../api/dataTypes";
import { dateToString } from "../../../utils/dates";
import styles from "./styles.module.css"

export default function ScannerHeader({ event, onInputBtn }: ScannerHeaderProps)
{
	return (
		<div className={styles.root}>
			<div className={styles.top}>
				<button onClick={onInputBtn}>Ручной ввод</button>
			</div>
			<div className={styles.bottom}>
				<span>{event.name}</span>
				<span>|</span>
				<span>{dateToString(event.date)}</span>
			</div>
		</div>
	);
}

interface ScannerHeaderProps
{
	event: EventData,
	onInputBtn: () => void,
}
