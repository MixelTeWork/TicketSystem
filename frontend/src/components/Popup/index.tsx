import { useEffect, useRef } from "react";
import classNames from "../../utils/classNames";
import styles from "./styles.module.css";

let openPopups = 0;
let bodyOverflow = "";

export default function Popup({ children, open = false, close, closeDisabled = false, title = "" }: CustomPopupProps)
{
	const root = useRef<HTMLDivElement>(null);
	const closeRef = useRef(close);
	closeRef.current = closeDisabled ? undefined : close;
	useEffect(() =>
	{
		if (!open) return;
		const previous = document.activeElement as HTMLElement | null;
		if (openPopups++ == 0) { bodyOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
		const controls = () => Array.from(root.current?.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]") || []).filter(element => !element.hasAttribute("disabled") && element.tabIndex >= 0 && element.getClientRects().length > 0);
		controls()[0]?.focus();
		const onKey = (event: KeyboardEvent) =>
		{
			if (Array.from(document.querySelectorAll('[data-popup-open="true"]')).at(-1) != root.current) return;
			if (event.key == "Escape" && closeRef.current) { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
			if (event.key != "Tab") return;
			const elements = controls();
			const first = elements[0], last = elements.at(-1);
			if (!first) { event.preventDefault(); return; }
			if (event.shiftKey && document.activeElement == first) { event.preventDefault(); last?.focus(); }
			else if (!event.shiftKey && document.activeElement == last) { event.preventDefault(); first.focus(); }
		};
		document.addEventListener("keydown", onKey);
		return () =>
		{
			document.removeEventListener("keydown", onKey);
			if (--openPopups == 0) document.body.style.overflow = bodyOverflow;
			if (previous?.isConnected) previous.focus();
		};
	}, [open]);
	return (
		<div ref={root} data-popup-open={open} className={classNames(styles.root, open && styles.open)}>
			<div className={styles.popup} role="dialog" aria-modal="true" aria-label={title || "Диалог"}>
				{
					(title || close) &&
					<div className={styles.header}>
						<h3>{title}</h3>
						{close && <button className={styles.close} onClick={close} disabled={closeDisabled} aria-label="Закрыть">×</button>}
					</div>
				}
				<div className={styles.body}>
					{children}
				</div>
			</div>
		</div>
	);
}

export interface PopupProps
{
	open?: boolean,
	close?: () => void,
}

interface CustomPopupProps extends PopupProps, React.PropsWithChildren
{
	title?: string,
	closeDisabled?: boolean,
}
