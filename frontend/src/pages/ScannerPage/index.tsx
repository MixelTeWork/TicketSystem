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
import useEvents from "../../api/events";
import { dateToString, relativeDate, secondsPast, timeToString } from "../../utils/dates";
import useUser from "../../api/user";

export default function ScannerPage()
{
	const [event, setEvent] = useState<EventData | null>(null);
	const [qrScanResult, setQrScanResult] = useState<string | null>(null);
	const [ticketCode, setTicketCode] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [checkTicketResult, setCheckTicketResult] = useState<CheckTicketResult | null>(null);
	const handleScan = useCallback((res: string) => setQrScanResult(res), []);
	const handleBackBtn = useCallback(() => { setEvent(null); setQrScanResult(null); setTicketCode(null); setError(null); setCheckTicketResult(null); mutation.reset(); }, []);
	const user = useUser();
	const events = useEvents();

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
			setCheckTicketResult(null);
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
			}, 1000);
			return () => clearTimeout(timeout);
		}
	}, [mutation]);

	return (
		<>
			{!event && <Layout centered gap="1em"><EventSelection setEvent={setEvent} /></Layout>}
			{event &&
				<Layout height100 header={<ScannerHeader event={event} onBackBtn={handleBackBtn} />}>
					<div className={classNames(styles.scanner, !mutation.isIdle && styles.scanner_scanned)}>
						<Scanner onScan={handleScan} />
						{/* <button onClick={() => handleScan("001-30809-03-0008")}>Scan!</button> */}
					</div>
					<div className={styles.scanResult}>
						{ticketCode && <div>Код билета: {ticketCode}</div>}
						{error && <div>{error}</div>}
						{checkTicketResult?.success && <>
							<div className={classNames(styles.success, styles.big)}>Действителен</div>
							<div className={styles.result_desc}>
								<div>Посетитель: {checkTicketResult.ticket.personName}</div>
								<div>Тип билета: {checkTicketResult.ticket.type}</div>
								<div>Промокод: {checkTicketResult.ticket.promocode}</div>
							</div>
						</>}
						{checkTicketResult?.errorCode == "notExist" && <div className={classNames(styles.error, styles.big)}>Не найден</div>}
						{checkTicketResult?.errorCode == "event" && <>
							<div className={classNames(styles.error, styles.big)}>Другое мероприятие</div>
							<div className={styles.result_desc}>
								{(() =>
								{
									const event = events.data?.find(v => v.id == checkTicketResult.ticket.eventId);
									if (!event) return <div>Неизвестное мероприятие</div>;
									return <>
										<div>Мероприятие: {event.name}</div>
										<div>Его дата: {dateToString(event.date)} ({relativeDate(event.date, "day")})</div>
									</>
								})()}
								<div>Посетитель: {checkTicketResult.ticket.personName}</div>
							</div>
						</>}
						{checkTicketResult?.errorCode == "scanned" && <>
							<div className={classNames(styles.error, styles.big)}>Использованный</div>
							<div className={styles.result_desc}>
								<div>
									<span>Кем: </span>
									{
										checkTicketResult.ticket.scannedById == user.data?.id ?
										<span>Вами</span> : <>
											<span>{checkTicketResult.ticket.scannedBy} </span>
											<span className={styles.error}>(Не вами)</span>
										</>
									}
								</div>
								<div>
									<span>Когда: </span>
									<span>{timeToString(checkTicketResult.ticket.scannedDate, true)} </span>
									<span
										className={classNames(secondsPast(checkTicketResult.ticket.scannedDate) > 30 && styles.error)}
									>({relativeDate(checkTicketResult.ticket.scannedDate)})</span>
								</div>
								<div style={{ marginTop: "0.5rem" }}>Посетитель: {checkTicketResult.ticket.personName}</div>
								<div>Тип билета: {checkTicketResult.ticket.type}</div>
								<div>Промокод: {checkTicketResult.ticket.promocode}</div>
							</div>
						</>}
					</div>
				</Layout>
			}
		</>
	);
}
