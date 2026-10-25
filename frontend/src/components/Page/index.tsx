import useStateObj from "../../utils/useStateObj";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import Spinner from "../Spinner";

export function PageHeading({ title, description, children }: { title: string, description?: string, children?: ReactNode })
{
	return <div className="page-heading">
		<div><h1>{title}</h1>{description && <p className="muted page-description">{description}</p>}</div>
		{children && <div className="actions">{children}</div>}
	</div>;
}

export function SearchField({ value, onChange, placeholder = "Поиск по имени или логину", maxLength }: { value: string, onChange: (value: string) => void, placeholder?: string, maxLength?: number })
{
	return <label className="search-field">Поиск<input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} /></label>;
}

export function matchesSearch(value: string, search: string)
{
	return value.toLocaleLowerCase("ru").includes(search.trim().toLocaleLowerCase("ru"));
}

type ColumnWidth = number | string | { weight: number, minWidth: number } | undefined;

export function DataTable({ children, className = "", footer, columns, scrollable = true, busy = false }: { children: ReactNode, className?: string, footer?: ReactNode, columns?: ColumnWidth[], scrollable?: boolean, busy?: boolean })
{
	const body = useRef<HTMLDivElement>(null);
	const availableWidth = useStateObj(0);
	const hasFlexibleColumns = columns?.some(width => typeof width != "string") ?? false;
	useLayoutEffect(() =>
	{
		const setAvailableWidth = availableWidth.set;
		if (!hasFlexibleColumns || !body.current) return;
		setAvailableWidth(body.current.clientWidth);
		if (typeof ResizeObserver == "undefined") return;
		const observer = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width));
		observer.observe(body.current);
		return () => observer.disconnect();
	}, [hasFlexibleColumns, availableWidth.set]);
	// col does not reliably resolve calc() with mixed percentages and pixels.
	const widths = tableColumnWidths(columns || [], availableWidth.v);
	return <div className={`table-wrap${scrollable ? "" : " table-wrap_unscrolled"}`}><div ref={body} className={`table-body${scrollable ? " table-scroll" : ""}`} aria-busy={busy}>
		<table className={`data-table ${className}`}>{columns && <colgroup>{widths.map((width, index) => <col key={index} style={{ width }} />)}</colgroup>}{children}</table>
		{busy && <div className="table-loading"><Spinner /></div>}
	</div>{footer && <div className="table-footer">{footer}</div>}</div>;
}

function tableColumnWidths(columns: ColumnWidth[], availableWidth: number)
{
	const widths: (string | number | undefined)[] = columns.map(width => typeof width == "string" ? width : undefined);
	let remaining = Math.max(0, availableWidth - columns.reduce<number>((total, width) => total + (typeof width == "string" ? parseFloat(width) || 0 : 0), 0));
	let flexible = columns.flatMap((width, index) => typeof width == "string" ? [] : [{ index, weight: typeof width == "object" ? width.weight : width ?? 1, minWidth: typeof width == "object" ? width.minWidth : 0 }]);
	if (!availableWidth) return widths;
	// Reserve constrained columns first, then share the rest proportionally.
	while (flexible.length)
	{
		const weight = flexible.reduce((total, column) => total + column.weight, 0);
		const constrained = flexible.filter(column => remaining * column.weight / weight < column.minWidth);
		if (!constrained.length)
		{
			flexible.forEach(column => widths[column.index] = remaining * column.weight / weight);
			break;
		}
		constrained.forEach(column => { widths[column.index] = column.minWidth; remaining = Math.max(0, remaining - column.minWidth); });
		flexible = flexible.filter(column => !constrained.includes(column));
	}
	return widths;
}

export function EmptyState({ children = "Ничего не найдено" }: { children?: ReactNode })
{
	return <p className="empty" role="status">{children}</p>;
}

export function Section({ title, actions, children, framed = true }: { title: string, actions?: ReactNode, children: ReactNode, framed?: boolean })
{
	return <section className={framed ? "panel" : undefined}><div className="panel-heading"><h2>{title}</h2><div className="actions">{actions}</div></div>{children}</section>;
}

export function CopyLink({ value }: { value: string })
{
	const result = useStateObj({ value: "", message: "" });
	const message = result.v.value == value ? result.v.message : "";
	return <><button className="button" onClick={async () =>
	{
		try { await navigator.clipboard.writeText(value); result.set({ value, message: "Скопировано" }); }
		catch { result.set({ value, message: "Не удалось скопировать ссылку" }); }
	}}>{message == "Скопировано" ? message : "Копировать ссылку"}</button>{message && message != "Скопировано" && <span role="status" className="danger-text">{message}</span>}</>;
}

export function Pagination({ page, pages, onChange, disabled = false }: { page: number, pages: number, onChange: (page: number) => void, disabled?: boolean })
{
	return <nav className="pagination" aria-label="Страницы списка">
		<button className="button button_small" aria-label="Первая страница" disabled={disabled || page <= 1} onClick={() => onChange(1)}>«</button>
		<button className="button button_small" aria-label="Предыдущая страница" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>‹</button>
		<label>Стр. <input key={page} type="number" min={1} max={pages} defaultValue={page} disabled={disabled} onBlur={e =>
		{
			const next = Math.max(1, Math.min(pages, Math.floor(Number(e.target.value)) || 1));
			e.target.value = String(next);
			if (next != page) onChange(next);
		}} onKeyDown={e => { if (e.key == "Enter") e.currentTarget.blur(); }} /></label>
		<span>из {pages}</span>
		<button className="button button_small" aria-label="Следующая страница" disabled={disabled || page >= pages} onClick={() => onChange(page + 1)}>›</button>
		<button className="button button_small" aria-label="Последняя страница" disabled={disabled || page >= pages} onClick={() => onChange(pages)}>»</button>
	</nav>;
}

export function SectionLinks({ links }: { links: { title: string, to: string }[] })
{
	if (links.length == 0) return null;
	return <nav className="section-links" aria-label="Разделы">{links.map(link => <Link key={link.to} to={link.to}>{link.title}</Link>)}</nav>;
}
