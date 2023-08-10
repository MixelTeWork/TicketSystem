import { useCallback, useEffect, useRef, useState } from "react";
import Layout from "../../components/Layout";
import styles from "./styles.module.css"
import { CheckTicketResult } from "../../api/dataTypes";
import Scanner from "../../components/Scanner";
import ScannerHeader from "./ScannerHeader";
import classNames from "../../utils/classNames";
import { useScannerEvent } from "../../api/events";
import { dateToString, relativeDate, secondsPast, timeToString } from "../../utils/dates";
import Popup from "../../components/Popup";
import { padNum } from "../../utils/nums";
import { useParams } from "react-router-dom";
import { useTitle } from "../../utils/useTtile";
import useMutationCheckTicket from "../../api/checkTicket";

export default function ScannerPage()
{
	useTitle("Сканер");
	const urlParams = useParams();
	const [qrScanResult, setQrScanResult] = useState<string | null>(null);
	const [ticketCode, setTicketCode] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [checkTicketResult, setCheckTicketResult] = useState<CheckTicketResult | null>(null);
	const [inputOpen, setInputOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const event = useScannerEvent(urlParams["eventId"]!);

	const handleScan = useCallback((res: string) => setQrScanResult(res), []);
	const handleOpenInput = useCallback(() =>
	{
		setInputOpen(true);
		if (inputRef.current && event.data && typeof event.data != "number")
			inputRef.current.value = `${padNum(event.data.id, 3)}-${event.data.date.getFullYear().toString().at(-1)}${padNum(event.data.date.getMonth() + 1, 2)}${padNum(event.data.date.getDate(), 2)}-`;
	}, [inputRef, event.data]);
	const handleCloseInput = useCallback(() => setInputOpen(false), []);

	const mutation = useMutationCheckTicket(
		setCheckTicketResult,
		error => { setCheckTicketResult(null); setError(error); }
	);

	useEffect(() =>
	{
		if (qrScanResult && event.data && mutation.status == "idle" && typeof event.data != "number")
		{
			setTicketCode(qrScanResult);
			setError(null);
			setQrScanResult(null);
			setCheckTicketResult(null);
			mutation.mutate({ code: qrScanResult, eventId: event.data.id });
		}
	}, [qrScanResult, event.data, mutation]);

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
			{event.isLoading && <Layout centered gap="1em" header={null}>Загрузка</Layout>}
			{event.error && <Layout centered gap="1em" header={null}>Произошла ошибка</Layout>}
			{typeof event.data == "number" && <Layout centered centeredPage gap="1em" header={null}>
				<div>Это событие ещё не началось или уже кончилось</div>
				<div>Если это не так, управляющий должен включить приём билетов</div>
			</Layout>}
			{typeof event.data != "number" && event.data &&
				<Layout height100 header={<ScannerHeader event={event.data} onInputBtn={handleOpenInput} />}>
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
									return <>
										<div>Мероприятие: {checkTicketResult.event.name}</div>
										<div>Его дата: {dateToString(checkTicketResult.event.date)} ({relativeDate(checkTicketResult.event.date, "day")})</div>
									</>
								})()}
								<div>Посетитель: {checkTicketResult.ticket.personName}</div>
							</div>
						</>}
						{checkTicketResult?.errorCode == "scanned" && <>
							<div className={classNames(styles.error, styles.big)}>Использованный</div>
							<div className={styles.result_desc}>
								{/* <div>
									<span>Кем: </span>
									{
										checkTicketResult.ticket.scannedById == user.data?.id ?
										<span>Вами</span> : <>
											<span>{checkTicketResult.ticket.scannedBy} </span>
											<span className={styles.error}>(Не вами)</span>
										</>
									}
								</div> */}
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
					<Popup title="Введите код билета" open={inputOpen} close={handleCloseInput}>
						<input type="text" ref={inputRef} />
						<button disabled={mutation.status != "idle"} onClick={() =>
						{
							if (inputRef.current)
								setQrScanResult(inputRef.current?.value);
							handleCloseInput();
						}}>Сканировать</button>
					</Popup>
				</Layout>
			}
		</>
	);
}
