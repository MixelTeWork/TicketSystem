import { useCallback, useEffect, useState } from "react";
import Layout from "../../components/Layout";
import styles from "./styles.module.css"
import EventSelection from "./EventSelection";
import { CheckTicketResult, EventData } from "../../api/dataTypes";
import Scanner from "../../components/Scanner";
import ScannerHeader from "./ScannerHeader";
import { useMutation } from "react-query";
import postCheckTicket from "../../api/checkTicket";
import ApiError from "../../api/apiError";
import classNames from "../../utils/classNames";

export default function ScannerPage()
{
	const [event, setEvent] = useState<EventData | null>(null);
	const [qrScanResult, setQrScanResult] = useState<string | null>(null);
	const [ticketCode, setTicketCode] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [checkTicketResult, setCheckTicketResult] = useState<CheckTicketResult | null>(null);
	const handleScan = useCallback((res: string) => setQrScanResult(res), []);
	const handleBackBtn = useCallback(() => { setEvent(null); setQrScanResult(null); setTicketCode(null); setError(null); setCheckTicketResult(null); mutation.reset(); }, []);

	const mutation = useMutation({
		mutationFn: postCheckTicket,
		onSuccess: (data) =>
		{
			setCheckTicketResult(data);
		},
		onError: (error) =>
		{
			setCheckTicketResult(null);
			setError(error instanceof ApiError ? error.message : "Произошла ошибка");
			mutation.reset();
		}
	});

	useEffect(() =>
	{
		if (qrScanResult && event && mutation.status == "idle")
		{
			setTicketCode(qrScanResult);
			setError(null);
			setQrScanResult(null);
			mutation.mutate({ code: qrScanResult, eventId: event.id });
		}
	}, [qrScanResult, event, mutation]);

	useEffect(() =>
	{
		if (mutation.isSuccess)
		{
			const timeout = setTimeout(() =>
			{
				setQrScanResult(null);
				mutation.reset();
			}, 500);
			return () => clearTimeout(timeout);
		}
	}, [mutation]);

	return (
		<>
			{!event && <Layout centered gap="1em"><EventSelection setEvent={setEvent} /></Layout>}
			{event &&
				<Layout height100 header={<ScannerHeader event={event} onBackBtn={handleBackBtn} />}>
					<div className={classNames(styles.scanner, !mutation.isIdle && styles.scanner_scanned)}>
						{/* <Scanner onScan={handleScan} /> */}
						<button onClick={() => handleScan("001-30807-67-0001")}>Scan!</button>
					</div>
					<div className={styles.scanResult}>
						{ticketCode && <div>Код билета: {ticketCode}</div>}
						{error && <div>{error}</div>}
						{checkTicketResult && <div>{checkTicketResult.errorCode}</div>}
					</div>
				</Layout>
			}
		</>
	);
}
