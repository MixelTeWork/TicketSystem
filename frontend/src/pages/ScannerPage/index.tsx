import { useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import useMutationCheckTicket from "../../api/checkTicket";
import { ApiError, type CheckTicketResult } from "../../api/dataTypes";
import { useScannerEvent } from "../../api/events";
import Layout from "../../components/Layout";
import Popup from "../../components/Popup";
import Scanner from "../../components/Scanner";
import Spinner from "../../components/Spinner";
import classNames from "../../utils/classNames";
import { dateToString, relativeDate, secondsPast, timeToString } from "../../utils/dates";
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
	const scannerEvent = useScannerEvent(urlParams["eventId"]!);
	const event = scannerEvent.data?.status == "active" ? scannerEvent.data.event : undefined;

	const [playBeep] = useSound(beep);
	const [playBeepError] = useSound(beepError);

	const handleScan = qrScanResult.set;
	const handleOpenInput = useCallback(() =>
	{
		const setInputOpen = inputOpen.set;
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
	}, [inputRef, event, inputOpen.set]);
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

	useEffect(() =>
	{
		const setAlreadyScanned = alreadyScanned.set;
		if (!alreadyScanned.v) return;
		const timeout = setTimeout(() => setAlreadyScanned(false), 500);
		return () => clearTimeout(timeout);
	}, [alreadyScanned.v, alreadyScanned.set]);

	return <>
		{scannerEvent.isFetching && <Layout header={null} centered><Spinner /></Layout>}
		{scannerEvent.error instanceof ApiError && scannerEvent.error.status == 403 && <NoPermissionPage />}
		{scannerEvent.isError && !(scannerEvent.error instanceof ApiError && scannerEvent.error.status == 403) && <Layout header={null} centered><p role="alert">Произошла ошибка загрузки мероприятия</p><button className="button" onClick={() => scannerEvent.refetch()}>Повторить</button></Layout>}
		{!scannerEvent.isError && !scannerEvent.isFetching && scannerEvent.data?.status == "inactive" && <Layout centered header={null}><p>Это событие ещё не началось или уже кончилось</p><p className="muted">Если это не так, управляющий должен включить приём билетов</p></Layout>}
		{!scannerEvent.isError && !scannerEvent.isFetching && event && <Layout height100 className={styles.body} header={<ScannerHeader event={event} onInputBtn={handleOpenInput} />}>
			<div className={classNames(styles.scanner, !mutation.isIdle && styles.scanner_scanned)}>
				<div className={styles.scannerRect}><Scanner onScan={handleScan} onCameraError={cameraError.setT} className={styles.scannerVideo} /></div>
				<p className={styles.cameraLabel}>Наведите камеру на QR-код билета</p>
			</div>
			<div className={styles.scanResult} role="status">
				{alreadyScanned.v && <span className="badge">Тот же билет</span>}
				{ticketCode.v && <code className={styles.code}>{ticketCode.v}</code>}
				{mutation.isPending && <Spinner />}
				{error.v && <p className="danger-text">{error.v}</p>}
				{!checkTicketResult.v && !error.v && !mutation.isPending && <><h2>Готов к проверке</h2><p className="muted">Отсканируйте QR-код или введите код вручную</p></>}
				{checkTicketResult.v && <ScanResult result={checkTicketResult.v} />}
			</div>
			<Popup title="Введите код билета" open={inputOpen.v} close={handleCloseInput}>
				<form className={styles.manual} onSubmit={e =>
				{
					e.preventDefault();
					if (inputRef.current?.value.trim()) qrScanResult.set(inputRef.current.value.trim());
					handleCloseInput();
				}}>
					<label>Код билета<input type="text" ref={inputRef} autoComplete="off" autoCapitalize="off" required /></label>
					<button className="button button_primary" type="submit" disabled={mutation.status != "idle"}>Проверить</button>
				</form>
			</Popup>
			<Popup title="Нет доступа к камере" open={cameraError.v && !startHintOpen.v} close={cameraError.setF}>
				<p>Разрешите использование камеры сайту и браузеру, затем перезагрузите страницу.</p>
				<button className="button button_primary" onClick={() => { cameraError.setF(); handleOpenInput(); }}>Ввести код вручную</button>
			</Popup>
			<Popup title="Сканер билетов" open={startHintOpen.v} close={startHintOpen.setF}>
				<h2>{event.name}</h2>
				<p>Наведите камеру на QR-код так, чтобы он поместился в рамку.</p>
				<p><strong>Включите звук</strong>, чтобы слышать сигнал при сканировании.</p>
				<button className="button button_primary" onClick={startHintOpen.setF}>Начать сканирование</button>
			</Popup>
		</Layout>}
	</>;
}

function ScanResult({ result }: { result: CheckTicketResult })
{
	if (result.errorCode == "notExist") return <h2 className="danger-text">Не найден</h2>;
	return <>
		<h2 className={result.success ? "success-text" : "danger-text"}>{result.success ? "Действителен" : result.errorCode == "event" ? "Другое мероприятие" : "Использованный"}</h2>
		{result.errorCode == "event" && <p>{result.event.name}<br /><span className="muted">{dateToString(result.event.date)} · {relativeDate(result.event.date, "day")}</span></p>}
		{(result.success || result.errorCode == "scanned") && result.ticket.scannedDate && <ScanAge date={result.ticket.scannedDate} />}
		<dl className={styles.details}>
			<dt>Посетитель</dt><dd>{result.ticket.personName || "—"}</dd>
			<dt>Тип билета</dt><dd>{result.ticket.type}</dd>
			<dt>Промокод</dt><dd>{result.ticket.promocode || "—"}</dd>
		</dl>
	</>;
}

function ScanAge({ date }: { date: Date })
{
	const refresh = useStateObj(0);
	useEffect(() =>
	{
		const setRefresh = refresh.set;
		const timer = setInterval(() => setRefresh(value => value + 1), 1000);
		return () => clearInterval(timer);
	}, [date, refresh.set]);
	return <p className={secondsPast(date) > 30 ? "danger-text" : "success-text"}><strong>{relativeDate(date)}</strong> <span className="muted">· {timeToString(date, true)}</span></p>;
}
