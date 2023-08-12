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
import { useParams } from "react-router-dom";
import { useTitle } from "../../utils/useTtile";
import useMutationCheckTicket from "../../api/checkTicket";
import Spinner from "../../components/Spinner";
import useSound from "../../utils/useSound";
import beep from "./beep.mp3";
import beepError from "./beepError.mp3";
import getTicketPrefix from "../../utils/getTicketPrefix";

export default function ScannerPage()
{
	useTitle("Сканер");
	const urlParams = useParams();
	const [qrScanResult, setQrScanResult] = useState<string | null>(null);
	const [ticketCode, setTicketCode] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [checkTicketResult, setCheckTicketResult] = useState<CheckTicketResult | null>(null);
	const [startHintOpen, setStartHintOpen] = useState(true);
	const [inputOpen, setInputOpen] = useState(false);
	const [alreadyScanned, setAlreadyScanned] = useState(false);
	const [cameraError, setCameraError] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const event = useScannerEvent(urlParams["eventId"]!);

	const [playBeep] = useSound(beep);
	const [playBeepError] = useSound(beepError);

	const handleScan = useCallback((res: string) => setQrScanResult(res), []);
	const handleOpenInput = useCallback(() =>
	{
		setInputOpen(true);
		if (inputRef.current && event.data && typeof event.data != "number")
		{
			setTimeout(() =>
			{
				if (inputRef.current)
					inputRef.current.focus();
			}, 50);
			inputRef.current.value = getTicketPrefix(event.data.id, event.data.date);
		}
	}, [inputRef, event.data]);
	const handleCloseInput = useCallback(() => setInputOpen(false), []);

	const mutation = useMutationCheckTicket(
		result =>
		{
			setCheckTicketResult(result);
			if (!result.success) playBeepError();
		},
		error =>
		{
			setCheckTicketResult(null);
			setError(error);
		}
	);

	useEffect(() =>
	{
		if (qrScanResult && event.data && mutation.status == "idle" && typeof event.data != "number")
		{
			playBeep();
			if (ticketCode == qrScanResult)
			{
				setQrScanResult(null);
				setAlreadyScanned(true);
				return
			}

			setAlreadyScanned(false);
			setTicketCode(qrScanResult);
			setError(null);
			setCheckTicketResult(null);
			mutation.mutate({ code: qrScanResult, eventId: event.data.id });
		}
	}, [qrScanResult, event.data, mutation.status]);

	useEffect(() =>
	{
		if (!mutation.isSuccess) return;
		const timeout = setTimeout(() =>
		{
			setQrScanResult(null);
			mutation.reset();
		}, 1000);
		return () => clearTimeout(timeout);
	}, [mutation.isSuccess]);

	useEffect(() =>
	{
		if (!alreadyScanned) return;
		const timeout = setTimeout(() => setAlreadyScanned(false), 500);
		return () => clearTimeout(timeout);
	}, [alreadyScanned]);

	return (
		<>
			{event.isLoading && <Spinner />}
			{event.error && <Layout centered gap="1em" header={null}>Произошла ошибка</Layout>}
			{typeof event.data == "number" && <Layout centered centeredPage gap="1em" header={null}>
				<div>Это событие ещё не началось или уже кончилось</div>
				<div>Если это не так, управляющий должен включить приём билетов</div>
			</Layout>}
			{typeof event.data != "number" && event.data &&
				<Layout height100 header={<ScannerHeader event={event.data} onInputBtn={handleOpenInput} />}>
					<div className={classNames(styles.scanner, !mutation.isIdle && styles.scanner_scanned)}>
						<div className={styles.scannerRect}>
							<Scanner onScan={handleScan} onCameraError={() => setCameraError(true)} className={styles.scannerVideo} />
						</div>
						{/* <button onClick={() => handleScan("001-30809-03-0008")}>Scan!</button> */}
					</div>
					<div className={styles.scanResult}>
						<div className={classNames(styles.alreadyScanned, alreadyScanned && styles.alreadyScanned_visible)}>Тот же билет</div>
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
						}}>Проверить</button>
					</Popup>
					<Popup open={cameraError}>
						<h1>Нет доступа к камере</h1>
						<p>Разрешите использование камеры этому сайту и браузеру, который вы используте.</p>
						<p>После перезагрузите страницу.</p>
					</Popup>
					<Popup title="Сканер билетов" open={startHintOpen} close={() => setStartHintOpen(false)}>
						<h2>{event.data.name}</h2>
						<p>Для сканирования билета наведите камеру на QR код так, чтобы он поместился в мигающую рамку.</p>
						<p><strong>Включите звук</strong>, чтобы слышать сигнал при сканировании.</p>
					</Popup>
				</Layout>
			}
		</>
	);
}
