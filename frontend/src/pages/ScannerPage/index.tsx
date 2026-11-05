import { useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import useMutationCheckTicket from "../../api/checkTicket";
import { ApiError } from "../../api/dataTypes";
import type { CheckTicketResult } from "../../api/tickets";
import { useScannerEvent } from "../../api/events";
import Layout from "../../components/Layout";
import Popup from "../../components/Popup";
import Scanner from "../../components/Scanner";
import Spinner from "../../components/Spinner";
import classNames from "../../utils/classNames";
import { datetimeToString, relativeDate, secondsPast } from "../../utils/dates";
import getTicketPrefix from "../../utils/getTicketPrefix";
import useSound from "../../utils/useSound";
import useStateBool from "../../utils/useStateBool";
import useStateObj from "../../utils/useStateObj";
import { useTitle } from "../../utils/useTitle";
import NoPermissionPage from "../NoPermissionPage";
import beep from "./beep.mp3";
import beepError from "./beepError.mp3";
import ScannerHeader from "./ScannerHeader";
import styles from "./styles.module.css";
import TicketDates from "../../components/TicketDates";
import { calendarDate, eventDateRange } from "../../utils/multiday";

export default function ScannerPage({ operation = "entry" }: { operation?: "entry" | "merch" })
{
	const urlParams = useParams();
	const eventId = urlParams["eventId"]!;
	return <ScannerSession key={`${eventId}:${operation}`} eventId={eventId} operation={operation} />;
}
function ScannerSession({ eventId, operation }: { eventId: string, operation: "entry" | "merch" })
{
	useTitle(operation == "merch" ? "Сканер мерча" : "Сканер входа");
	const qrScanResult = useStateObj<string | null>(null);
	const ticketCode = useStateObj<string | null>(null);
	const error = useStateObj<string | null>(null);
	const checkTicketResult = useStateObj<CheckTicketResult | null>(null);
	const startHintOpen = useStateBool(true);
	const inputOpen = useStateBool(false);
	const alreadyScanned = useStateBool(false);
	const cameraError = useStateBool(false);
	const manualMode = useStateBool(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const scannerEvent = useScannerEvent(eventId);
	const event = scannerEvent.data?.status == "active" ? scannerEvent.data.event : undefined;

	const [playBeep] = useSound(beep);
	const [playBeepError] = useSound(beepError);

	const handleScan = qrScanResult.set;
	const handleOpenInput = useCallback(() =>
	{
		const setInputOpen = inputOpen.set;
		const setManualMode = manualMode.set;
		const setCameraError = cameraError.set;
		setManualMode(true);
		setCameraError(false);
		setInputOpen(true);
		if (inputRef.current && event)
		{
			setTimeout(() =>
			{
				if (inputRef.current)
					inputRef.current.focus();
			}, 50);
			inputRef.current.value = getTicketPrefix(event.id, event.date);
		}
	}, [inputRef, event, inputOpen.set, manualMode.set, cameraError.set]);
	const handleCameraError = useCallback(() =>
	{
		const setManualMode = manualMode.set;
		const setCameraError = cameraError.set;
		setManualMode(true);
		setCameraError(true);
	}, [manualMode.set, cameraError.set]);
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
		operation,
	);

	useEffect(() =>
	{
		const setQrScanResult = qrScanResult.set;
		const setAlreadyScanned = alreadyScanned.set;
		const setTicketCode = ticketCode.set;
		const setError = error.set;
		const setCheckTicketResult = checkTicketResult.set;
		if (qrScanResult.v && event && !scannerEvent.isError && !scannerEvent.isFetching && mutation.status == "idle")
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
			mutation.mutate({ code: qrScanResult.v, eventId: event.id });
		}
		// eslint-disable-next-line
	}, [qrScanResult.v, event, scannerEvent.isError, scannerEvent.isFetching, mutation.status, qrScanResult.set, alreadyScanned.set, ticketCode.set, error.set, checkTicketResult.set]);

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

	return <>
		{scannerEvent.isFetching && <Layout header={null} centered><Spinner /></Layout>}
		{scannerEvent.error instanceof ApiError && scannerEvent.error.status == 403 && <NoPermissionPage />}
		{scannerEvent.isError && !(scannerEvent.error instanceof ApiError && scannerEvent.error.status == 403) && <Layout header={null} centered><p role="alert">Произошла ошибка загрузки мероприятия</p><button className="button" onClick={() => scannerEvent.refetch()}>Повторить</button></Layout>}
		{!scannerEvent.isError && !scannerEvent.isFetching && scannerEvent.data?.status == "inactive" && <Layout centered header={null}><p>Сканирование выключено организатором</p><p className="muted">Организатор может включить приём билетов и выдачу мерча в настройках мероприятия</p></Layout>}
		{!scannerEvent.isError && !scannerEvent.isFetching && event && <Layout height100 className={classNames(styles.body, manualMode.v && styles.manualMode)} header={<ScannerHeader operation={operation} event={event} onInputBtn={handleOpenInput} />}>
			{manualMode.v ? <div className={styles.cameraControls}>
				<span className="muted">Ручной режим</span>
				<button type="button" className="button" onClick={() => { cameraError.setF(); manualMode.setF(); }}>Вернуться к камере</button>
			</div> : <div className={classNames(styles.scanner, !mutation.isIdle && styles.scanner_scanned)}>
				<div className={styles.scannerRect}><Scanner onScan={handleScan} onCameraError={handleCameraError} className={styles.scannerVideo} /></div>
				<p className={styles.cameraLabel}>Наведите камеру на QR-код билета</p>
			</div>}
			<div className={styles.scanResult} role="status" aria-label="Результат проверки">
				{ticketCode.v && <code className={styles.code}>{ticketCode.v}</code>}
				{mutation.isPending && <Spinner />}
				{error.v && <p className="danger-text">{error.v}</p>}
				{!checkTicketResult.v && !error.v && !mutation.isPending && <><h2>Готов к проверке</h2><p className="muted">Отсканируйте QR-код или введите код вручную</p></>}
				{checkTicketResult.v && <ScanResult result={checkTicketResult.v} repeated={alreadyScanned.v} />}
			</div>
			<Popup title="Введите код билета" open={inputOpen.v} close={handleCloseInput}>
				<form className={styles.manual} onSubmit={e =>
				{
					e.preventDefault();
					if (inputRef.current?.value.trim()) qrScanResult.set(inputRef.current.value.trim());
					handleCloseInput();
				}}>
					<label>Код билета<input type="text" ref={inputRef} autoComplete="off" autoCapitalize="off" required /></label>
					<p className="muted">После переноса мероприятия код может содержать прежнюю дату. Введите полный код с билета.</p>
					<button className="button button_primary" type="submit" disabled={mutation.status != "idle"}>Проверить</button>
				</form>
			</Popup>
			<Popup title="Нет доступа к камере" open={cameraError.v && !startHintOpen.v} close={cameraError.setF}>
				<p>Разрешите использование камеры сайту и браузеру, затем перезагрузите страницу.</p>
				<button className="button button_primary" onClick={handleOpenInput}>Ввести код вручную</button>
			</Popup>
			<Popup title={operation == "merch" ? "Выдача мерча" : "Вход по билетам"} open={startHintOpen.v} close={startHintOpen.setF}>
				<h2>{event.name}</h2>
				<p>Наведите камеру на QR-код так, чтобы он поместился в рамку.</p>
				<p><strong>Включите звук</strong>, чтобы слышать сигнал при сканировании.</p>
				<button className="button button_primary" onClick={startHintOpen.setF}>Начать сканирование</button>
			</Popup>
		</Layout>}
	</>;
}

function ScanResult({ result, repeated }: { result: CheckTicketResult, repeated: boolean })
{
	const merch = result.operation == "merch";
	const title = result.errorCode == "notExist" || !result.ticket ? "Не найден" : result.success ? merch ? "Мерч выдан" : "Вход разрешён" : result.errorCode == "event" ? "Другое мероприятие" : result.errorCode == "date" ? "Не действует сегодня" : merch ? "Мерч уже выдан" : "Уже проходил";
	const heading = repeated ? <>
		<h2 className={styles.repeatTitle}>Этот билет уже проверен на этом экране</h2>
		<p className={styles.previousResult}><strong>Предыдущий результат: {title.toLocaleLowerCase("ru")}</strong></p>
		<p className="muted">{merch ? "Новая выдача мерча не выполнялась." : "Новый проход не отмечался."}</p>
	</> : <h2 className={result.success ? "success-text" : "danger-text"}>{title}</h2>;
	if (result.errorCode == "notExist" || !result.ticket) return heading;
	const stamp = merch ? result.ticket.merchIssuedAt : result.checkin?.checkedAt;
	const actor = merch ? result.ticket.merchIssuedBy : result.checkin?.checkedBy;
	return <>
		{heading}
		{result.errorCode == "event" && result.event && <p>{result.event.name}<br /><span className="muted">{eventDateRange(result.event)}</span></p>}
		{result.checkin && <p>День входа: {calendarDate(result.checkin.dayDate, true)}</p>}
		{(result.success || result.errorCode == "scanned" || result.errorCode == "merchIssued") && <>{stamp ? <ScanAge date={stamp} repeated={repeated} /> : <p>Время исторического прохода неизвестно</p>}<p>Сотрудник: {actor ?? "неизвестен"}</p></>}
		<dl className={styles.details}>
			<dt>Посетитель</dt><dd>{result.ticket.personName || "—"}</dd>
			<dt>Тип билета</dt><dd>{result.ticket.type}</dd>
			<dt>Даты действия</dt><dd><TicketDates dates={result.ticket.validDates} /></dd>
			<dt>Промокод</dt><dd>{result.ticket.promocode || "—"}</dd>
		</dl>
	</>;
}

function ScanAge({ date, repeated }: { date: Date, repeated: boolean })
{
	const refresh = useStateObj(0);
	useEffect(() =>
	{
		const setRefresh = refresh.set;
		const timer = setInterval(() => setRefresh(value => value + 1), 1000);
		return () => clearInterval(timer);
	}, [date, refresh.set]);
	return <p className={repeated ? "muted" : secondsPast(date) > 30 ? "danger-text" : "success-text"}><strong>{relativeDate(date)}</strong> <span className="muted">· {datetimeToString(date, true)} МСК</span></p>;
}
