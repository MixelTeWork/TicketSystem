import { useState } from "react";
import Layout from "../../components/Layout";
import styles from "./styles.module.css"
import EventSelection from "./EventSelection";
import { EventData } from "../../api/dataTypes";
import Scanner from "./Scanner";
import ScannerHeader from "./ScannerHeader";

export default function ScannerPage()
{
	const [event, setEvent] = useState<EventData | null>(null);

	return (
		<>
			{!event && <Layout centered gap="1em"><EventSelection setEvent={setEvent} /></Layout>}
			{event &&
				<Layout header={<ScannerHeader event={event} setEvent={setEvent} />}>
					<Scanner event={event} />
				</Layout>
			}
		</>
	);
}
