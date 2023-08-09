import { EventData } from "../../../api/dataTypes";
import styles from "./styles.module.css"

export default function ScannerHeader({ event, onBackBtn }: ScannerHeaderProps)
{
	return (
		<div className={styles.root}>
			<div className={styles.top}>
				<button onClick={onBackBtn}>Назад</button>
				<button>Ручной ввод</button>
			</div>
			<div className={styles.bottom}>
				<span>{event.name}</span>
				<span>|</span>
				<span>
					{`${event.date.getDate()}`.padStart(2, "0")}
					.{`${event.date.getMonth() + 1}`.padStart(2, "0")}
					.{event.date.getFullYear()}
				</span>
			</div>
		</div>
	);
}

interface ScannerHeaderProps
{
	event: EventData,
	onBackBtn: () => void,
}
