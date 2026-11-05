import { useEffect, useRef } from "react";
import useStateObj from "../../utils/useStateObj";
import useStateBool from "../../utils/useStateBool";
import { Form, FormField } from "../Form";
import Popup, { type PopupProps } from "../Popup";
import { useMutationNewTicket, type NewTicketData } from "../../api/tickets";
import Spinner from "../Spinner";
import { useTicketTypes } from "../../api/ticketTypes";
import { ApiError } from "../../api/dataTypes";
import type { Ticket } from "../../api/tickets";
import useUser from "../../api/user";
import displayError from "../../utils/displayError";
import TicketFormFields from "../TicketFormFields";
import { ticketFormData, ticketFormValues } from "../TicketFormFields/values";
import { newRequestId, pendingTicketKey, readPendingTicket, writePendingTicket, type PendingTicket } from "../../utils/pendingTicket";

export default function CreateTicketForm({ open, eventId, close, setTicket }: CreateTicketFormProps)
{
	const values = useStateObj(ticketFormValues);
	const code = useStateObj("");
	const autocode = useStateBool(true);
	const pending = useStateObj<PendingTicket | null>(null);
	const activeRequest = useStateObj<{ key: string, requestId: string, quota: PendingTicket | null } | null>(null);
	const discard = useStateBool(false);
	const resumeOpen = useStateBool(false);
	const formOpen = open || resumeOpen.v;
	const storageError = useStateObj("");
	const user = useUser();
	const key = pendingTicketKey(user.data?.id ?? -1, eventId);
	const current = useRef({ key, requestId: "" });
	if (current.current.key != key) current.current = { key, requestId: "" };
	const mutation = useMutationNewTicket();
	const ticketTypes = useTicketTypes(eventId);
	const initialized = useRef("");
	const sending = useRef<{ key: string, requestId: string } | null>(null);
	const mounted = useRef(true);
	const { reset } = mutation;
	useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

	useEffect(() =>
	{
		const setPending = pending.set;
		const setValues = values.set;
		const setCode = code.set;
		const setAutocode = autocode.set;
		if (initialized.current != key)
		{
			initialized.current = key;
			const saved = readPendingTicket(key);
			setPending(saved);
			current.current = { key, requestId: saved?.payload.requestId ?? "" };
			setValues(saved ? { ...ticketFormValues(), ...saved.payload, price: `${saved.payload.price ?? ""}` } : ticketFormValues());
			setCode(saved?.payload.code ?? "");
			setAutocode(!saved?.payload.code);
			reset();
		}
		if (!formOpen && !readPendingTicket(key))
		{
			setValues(ticketFormValues()); setCode(""); setAutocode(true); reset();
		}
		if (formOpen && !readPendingTicket(key))
		{
			const type = ticketTypes.data?.[0];
			if (type) setValues(previous => previous.typeId < 0 ? { ...previous, typeId: type.id, price: `${type.price ?? ""}` } : previous);
		}
	}, [key, formOpen, ticketTypes.data, pending.set, values.set, code.set, autocode.set, reset]);

	function save(action: PendingTicket | null)
	{
		try { writePendingTicket(key, action); }
		catch { storageError.set("Не удалось сохранить действие в этой вкладке. Разрешите sessionStorage и повторите."); return false; }
		pending.set(action);
		current.current = { key, requestId: action?.payload.requestId ?? "" };
		return true;
	}
	async function send(payload: NewTicketData, hadUnknown = false)
	{
		const quota = pending.v?.status == "quota" ? pending.v : null;
		if (sending.current?.key == key || mutation.isPending || !save({ payload, status: "unknown" })) return;
		sending.current = { key, requestId: payload.requestId };
		activeRequest.set({ key, requestId: payload.requestId, quota });
		try
		{
			const ticket = await mutation.mutateAsync(payload);
			if (!mounted.current || current.current.key != key || current.current.requestId != payload.requestId || readPendingTicket(key)?.payload.requestId != payload.requestId) return;
			if (!save(null)) return;
			values.set(ticketFormValues()); code.set(""); autocode.set(true);
			setTicket(ticket); resumeOpen.setF(); close?.();
		}
		catch (error)
		{
			if (!mounted.current || current.current.key != key || current.current.requestId != payload.requestId || readPendingTicket(key)?.payload.requestId != payload.requestId) return;
			if (error instanceof ApiError && error.code == "ticket_limit_confirmation_required") save({ payload, status: "quota", details: error.details });
			else if (!hadUnknown && error instanceof ApiError && (error.status == 400 || error.code == "variant_unavailable")) save(null);
		}
		finally
		{
			if (sending.current?.key == key && sending.current.requestId == payload.requestId) sending.current = null;
			if (mounted.current) activeRequest.set(previous => previous?.key == key && previous.requestId == payload.requestId ? null : previous);
		}
	}
	const request = activeRequest.v?.key == key ? activeRequest.v : null;
	const quota = pending.v?.status == "quota" ? pending.v : request?.quota;
	const busy = !!request || mutation.isPending;
	const quotaError = mutation.error instanceof ApiError && mutation.error.code == "ticket_limit_confirmation_required";
	return <>
		{!formOpen && pending.v && <button type="button" className="button button_primary" onClick={resumeOpen.setT}>Продолжить незавершённое создание билета</button>}
		<Popup open={formOpen} close={() => { resumeOpen.setF(); close?.(); }} title="Добавление билета">
			{!quotaError && displayError(mutation)}
			{storageError.v && <p role="alert" className="danger-text">{storageError.v}</p>}
			{ticketTypes.isLoading && <Spinner />}
			{busy && <p role="status">{quota ? "Создаём билет сверх лимита…" : "Создаём билет…"}</p>}
			{pending.v && (quota || !busy) && <div role={busy ? undefined : "alert"}>
				{!busy && <p>{quota ? "Лимит разновидности исчерпан. Билет ещё не создан." : "Результат создания неизвестен. Повторите исходное действие, чтобы получить созданный билет без дубля."}</p>}
				{quota && <>
					<p><strong>{quota.payload.personName}</strong><br />{ticketTypes.data?.find(type => type.id == quota.payload.typeId)?.name ?? `Вид билета №${quota.payload.typeId}`}</p>
					<QuotaDetails details={quota.details} />
				</>}
				{!busy && <div className="actions"><button type="button" className="button button_primary" onClick={() => { if (pending.v) void send({ ...pending.v.payload, ...(quota ? { allowOverLimit: true } : {}) }, !quota); }}>{quota ? "Добавить сверх лимита" : "Повторить исходное действие"}</button>
					<button type="button" className="button" onClick={() =>
					{
						if (quota) { save(null); reset(); }
						else discard.setT();
					}}>{quota ? "Отмена" : "Начать другой билет"}</button></div>}
				{discard.v && <div><p>Билет мог уже создаться. Начало другого действия может привести к двум билетам. Сначала проверьте список.</p><button type="button" className="button button_danger" onClick={() => { save(null); reset(); discard.setF(); }}>Начать новое действие</button><button type="button" className="button" onClick={discard.setF}>Продолжить прежнее</button></div>}
			</div>}
			{!quota && <Form disabled={busy || !!pending.v} onSubmit={() =>
			{
				if (!pending.v && ticketTypes.data?.some(type => type.id == values.v.typeId) && values.v.personName && !mutation.isPending)
					void send({ eventId: Number(eventId), ...ticketFormData(values.v), code: autocode.v ? "" : code.v, requestId: newRequestId() });
			}}>
				<fieldset disabled={busy || !!pending.v} style={{ display: "contents" }}>
					<TicketFormFields values={values} ticketTypes={ticketTypes.data} resetPriceOnTypeChange pricePlaceholder="не указана" />
					<label><input type="checkbox" checked={autocode.v} onChange={e => autocode.set(e.target.checked)} /><span style={{ color: autocode.v ? "darkgreen" : "darkred" }}>Авто-код билета</span></label>
					{!autocode.v && <FormField label="Код билета (ручной ввод)"><div className="danger-text">Не используйте без необходимости!</div><input value={code.v} onChange={e => code.set(e.target.value)} type="text" /></FormField>}
					<button type="submit" className="button button_small" disabled={busy || !!pending.v || !ticketTypes.data?.length}>Создать</button>
				</fieldset>
			</Form>}
		</Popup>
	</>;
}

export function QuotaDetails({ details }: { details: unknown })
{
	const data = isQuotaDetails(details) ? details : null;
	return data && <p>Лимит: {data.quantity} · Выдано: {data.issuedCount} · Осталось: {data.remaining}</p>;
}
interface CreateTicketFormProps extends PopupProps { eventId: number | string; setTicket: (ticket: Ticket) => void; }

interface TicketLimitDetails { quantity: number; issuedCount: number; remaining: number; }
function isQuotaDetails(value: unknown): value is TicketLimitDetails
{
	return typeof value == "object" && value !== null && "quantity" in value && typeof value.quantity == "number" && "issuedCount" in value && typeof value.issuedCount == "number" && "remaining" in value && typeof value.remaining == "number";
}
