import useStateObj from "../../utils/useStateObj";
import useStateBool from "../../utils/useStateBool";
import { useCallback, useEffect, useRef } from "react";
import Layout from "../../components/Layout";
import styles from "./styles.module.css";
import { type CheckTicketResult } from "../../api/dataTypes";
import Scanner from "../../components/Scanner";
import ScannerHeader from "./ScannerHeader";
import classNames from "../../utils/classNames";
import { useScannerEvent } from "../../api/events";
import { dateToString, relativeDate, secondsPast, timeToString } from "../../utils/dates";
import Popup from "../../components/Popup";
import { useParams } from "react-router-dom";
import { useTitle } from "../../utils/useTitle";
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
	const qrScanResult = useStateObj<string | null>(null);
	const ticketCode = useStateObj<string | null>(null);
	const error = useStateObj<string | null>(null);
	const checkTicketResult = useStateObj<CheckTicketResult | null>(null);
	const startHintOpen = useStateBool(true);
	const inputOpen = useStateBool(false);
	const alreadyScanned = useStateBool(false);
	const cameraError = useStateBool(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const event = useScannerEvent(urlParams["eventId"]!);

	const [playBeep] = useSound(beep);
	const [playBeepError] = useSound(beepError);

	const handleScan = qrScanResult.set;
	const handleOpenInput = useCallback(() =>
	{
		const setInputOpen = inputOpen.set;
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
	}, [inputRef, event.data, inputOpen.set]);
	const handleCloseInput = useCallback(() =>
	{
		const setInputOpen = inputOpen.set;
		return setInputOpen(false);
	}, [inputOpen.set]);

	const mutation = useMutationCheckTicket(
		result =>
		{
			checkTicketResult.set(result);
			if (!result.success) playBeepError();
		},
		errorMessage =>
		{
			checkTicketResult.set(null);
			error.set(errorMessage);
		},
	);

	useEffect(() =>
	{
		const setQrScanResult = qrScanResult.set;
		const setAlreadyScanned = alreadyScanned.set;
		const setTicketCode = ticketCode.set;
		const setError = error.set;
		const setCheckTicketResult = checkTicketResult.set;
		if (qrScanResult.v && event.data && mutation.status == "idle" && typeof event.data != "number")
		{
			playBeep();
			if (ticketCode.v == qrScanResult.v && !error.v)
			{
				setQrScanResult(null);
				setAlreadyScanned(true);
				return;
			}

			setQrScanResult(null);
			setAlreadyScanned(false);
			setTicketCode(qrScanResult.v);
			setError(null);
			setCheckTicketResult(null);
			mutation.mutate({ code: qrScanResult.v, eventId: event.data.id });
		}
		// eslint-disable-next-line
	}, [qrScanResult.v, event.data, mutation.status, qrScanResult.set, alreadyScanned.set, ticketCode.set, error.set, checkTicketResult.set]);

	useEffect(() =>
	{
		const setQrScanResult = qrScanResult.set;
		if (!mutation.isSuccess) return;
		const timeout = setTimeout(() =>
		{
			setQrScanResult(null);
			mutation.reset();
		}, 1000);
		return () => clearTimeout(timeout);
		// eslint-disable-next-line
	}, [mutation.isSuccess, qrScanResult.set]);

	useEffect(() =>
	{
		const setAlreadyScanned = alreadyScanned.set;
		if (!alreadyScanned.v) return;
		const timeout = setTimeout(() => setAlreadyScanned(false), 500);
		return () => clearTimeout(timeout);
	}, [alreadyScanned.v, alreadyScanned.set]);

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
							<Scanner onScan={handleScan} onCameraError={cameraError.setT} className={styles.scannerVideo} />
						</div>
						{/* <button onClick={() => handleScan("001-30809-03-0008")}>Scan!</button> */}
					</div>
					<div className={styles.scanResult}>
						<div className={classNames(styles.alreadyScanned, alreadyScanned.v && styles.alreadyScanned_visible)}>Тот же билет</div>
						{ticketCode.v && <div>Код билета: {ticketCode.v}</div>}
						{error.v && <div>{error.v}</div>}
						{checkTicketResult.v?.success && <>
							<div className={classNames(styles.success, styles.big)}>Действителен</div>
							<div className={styles.result_desc}>
								<div>Посетитель: {checkTicketResult.v.ticket.personName}</div>
								<div>Тип билета: {checkTicketResult.v.ticket.type}</div>
								<div>Промокод: {checkTicketResult.v.ticket.promocode}</div>
							</div>
						</>}
						{checkTicketResult.v?.errorCode == "notExist" && <div className={classNames(styles.error, styles.big)}>Не найден</div>}
						{checkTicketResult.v?.errorCode == "event" && <>
							<div className={classNames(styles.error, styles.big)}>Другое мероприятие</div>
							<div className={styles.result_desc}>
								{(() =>
								{
									return <>
										<div>Мероприятие: {checkTicketResult.v.event.name}</div>
										<div>Его дата: {dateToString(checkTicketResult.v.event.date)} ({relativeDate(checkTicketResult.v.event.date, "day")})</div>
									</>;
								})()}
								<div>Посетитель: {checkTicketResult.v.ticket.personName}</div>
							</div>
						</>}
						{checkTicketResult.v?.errorCode == "scanned" && <>
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
									<span>{timeToString(checkTicketResult.v.ticket.scannedDate, true)} </span>
									<span
										className={classNames(secondsPast(checkTicketResult.v.ticket.scannedDate) > 30 && styles.error)}
									>({relativeDate(checkTicketResult.v.ticket.scannedDate)})</span>
								</div>
								<div style={{ marginTop: "0.5rem" }}>Посетитель: {checkTicketResult.v.ticket.personName}</div>
								<div>Тип билета: {checkTicketResult.v.ticket.type}</div>
								<div>Промокод: {checkTicketResult.v.ticket.promocode}</div>
							</div>
						</>}
					</div>
					<Popup title="Введите код билета" open={inputOpen.v} close={handleCloseInput}>
						<input type="text" ref={inputRef} />
						<button disabled={mutation.status != "idle"} onClick={() =>
						{
							if (inputRef.current)
								qrScanResult.set(inputRef.current?.value);
							handleCloseInput();
						}}>Проверить</button>
					</Popup>
					<Popup open={cameraError.v}>
						<h1>Нет доступа к камере</h1>
						<p>Разрешите использование камеры этому сайту и браузеру, который вы используте.</p>
						<p>После перезагрузите страницу.</p>
					</Popup>
					<Popup title="Сканер билетов" open={startHintOpen.v} close={startHintOpen.setF}>
						<h2>{event.data.name}</h2>
						<p>Для сканирования билета наведите камеру на QR код так, чтобы он поместился в мигающую рамку.</p>
						<p><strong>Включите звук</strong>, чтобы слышать сигнал при сканировании.</p>
					</Popup>
				</Layout>
			}
		</>
	);
}
