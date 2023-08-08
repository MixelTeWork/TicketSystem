import { EventData } from "../../../api/dataTypes";
import styles from "./styles.module.css"

export default function Scanner({ event }: ScannerProps)
{
	return (
		<div className={styles.root}>Scanner</div>
	);
}

interface ScannerProps
{
	event: EventData,
}