import { useCallback, useState } from "react";
import Layout from "../../components/Layout";
import styles from "./styles.module.css"
import EventSelection from "./EventSelection";
import { EventData } from "../../api/dataTypes";
import Scanner from "../../components/Scanner";
import ScannerHeader from "./ScannerHeader";

export default function ScannerPage()
{
	const [event, setEvent] = useState<EventData | null>(null);
	const [scanResult, setScanResult] = useState<string | null>(null);
	const handleScan = useCallback((res: string) => setScanResult(res), []);

	return (
		<>
			{!event && <Layout centered gap="1em"><EventSelection setEvent={setEvent} /></Layout>}
			{event &&
				<Layout height100 header={<ScannerHeader event={event} setEvent={setEvent} />}>
					<div className={styles.scanner}>
						<Scanner onScan={handleScan} />
					</div>
					<div className={styles.scanResult}>
						<div>{scanResult}</div>
						{scanResult && <button className="button" onClick={() => setScanResult(null)}>Сканировать ещё!</button>}
					</div>
				</Layout>
			}
		</>
	);
}
