import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import useUser from "../../api/user";
import { useAcknowledgeNotices, useHelpNotices } from "../../api/help";
import Popup from "../Popup";
import displayError from "../../utils/displayError";
import styles from "./styles.module.css";

interface DeferredNotices { sessionId: string; noticeIds: string[]; }

function readDeferred(key: string): DeferredNotices | null
{
	try
	{
		const value: unknown = JSON.parse(localStorage.getItem(key) || "null");
		if (value && typeof value == "object" && "sessionId" in value && typeof value.sessionId == "string" && "noticeIds" in value && Array.isArray(value.noticeIds) && value.noticeIds.every(id => typeof id == "string"))
			return { sessionId: value.sessionId, noticeIds: value.noticeIds };
	}
	catch { /* Storage can be disabled; deferral still works for the mounted session. */ }
	return null;
}

export default function HelpNotices()
{
	const location = useLocation();
	const user = useUser();
	const safeScreen = /^\/(?:events(?:\/\d+)?|staff|fonts|managers)?$/.test(location.pathname);
	const [available, setAvailable] = useState(false);
	const notices = useHelpNotices(safeScreen && available);
	const [deferred, setDeferred] = useState<DeferredNotices | null>(null);
	const storageKey = `help-notice-deferred:${user.data?.id}`;
	const sessionId = notices.data?.sessionId;
	const refreshDeferred = useCallback(() => setDeferred(readDeferred(storageKey)), [storageKey]);
	useEffect(() =>
	{
		refreshDeferred();
		window.addEventListener("storage", refreshDeferred);
		return () => window.removeEventListener("storage", refreshDeferred);
	}, [refreshDeferred]);

	useEffect(() =>
	{
		function update()
		{
			const otherPopup = [...document.querySelectorAll('[data-popup-open="true"]')].some(element => !element.closest("[data-help-notice]"));
			const editing = document.activeElement?.matches("input, textarea, select, [contenteditable=true]") ?? false;
			setAvailable(safeScreen && !otherPopup && !editing);
		}
		const observer = new MutationObserver(update);
		observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-popup-open"] });
		document.addEventListener("focusin", update);
		document.addEventListener("focusout", update);
		update();
		return () => { observer.disconnect(); document.removeEventListener("focusin", update); document.removeEventListener("focusout", update); };
	}, [safeScreen]);

	const items = (notices.data?.items || []).filter(item => !deferred || deferred.sessionId != sessionId || !deferred.noticeIds.includes(item.id));
	function close()
	{
		if (!sessionId) return;
		const value = { sessionId, noticeIds: [...new Set([...(deferred?.sessionId == sessionId ? deferred.noticeIds : []), ...items.map(item => item.id)])] };
		setDeferred(value);
		try { localStorage.setItem(storageKey, JSON.stringify(value)); }
		catch { /* Keep the in-memory deferral when storage is unavailable. */ }
	}
	const acknowledge = useAcknowledgeNotices(close);
	if (!safeScreen || !available || !items.length || notices.isFetching) return null;
	return <div data-help-notice className={styles.root}>
		<Popup open close={close} closeDisabled={acknowledge.isPending} title="Важные изменения">
			<div className={styles.items}>{items.map(item => <section key={item.id}>
				<h2>{item.title}</h2><p>{item.text}</p>
				{item.articleId && <Link to={`/help/${item.articleId}`} onClick={close}>Подробнее в инструкции</Link>}
			</section>)}</div>
			{displayError(acknowledge)}
			<div className={styles.actions}><Link to="/whats-new" onClick={close}>Все изменения</Link><button className="button button_primary" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate(items.map(item => item.id))}>{acknowledge.isPending ? "Сохранение…" : "Понятно"}</button></div>
		</Popup>
	</div>;
}
