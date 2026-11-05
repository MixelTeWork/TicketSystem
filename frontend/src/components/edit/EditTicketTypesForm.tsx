import { useEffect, useRef } from "react";
import { useMutationUpdateCatalog, useTicketCatalog, type CatalogChanges, type CatalogVariant, type TicketCategory } from "../../api/ticketTypes";
import type { EventData } from "../../api/events";
import displayError from "../../utils/displayError";
import useStateObj from "../../utils/useStateObj";
import { calendarDayLabel } from "../../utils/multiday";
import { newRequestId } from "../../utils/pendingTicket";
import { Form } from "../Form";
import Popup, { type PopupProps } from "../Popup";
import Spinner from "../Spinner";
import TicketDates from "../TicketDates";
import styles from "./styles.module.css";

interface VariantDraft { id?: number; name: string; price: number | null; quantity: number | null; dayOffsets: number[]; selected: boolean; }
interface CategoryDraft { key: string; id?: number; name: string; removed: boolean; variants: VariantDraft[]; }
function variantDraft(variant: CatalogVariant): VariantDraft
{
	return { id: variant.id, name: variant.name, price: variant.price, quantity: variant.quantity, dayOffsets: variant.dayOffsets, selected: !variant.deleted };
}
function categoryDraft(category: TicketCategory): CategoryDraft
{
	return { key: `saved-${category.id}`, id: category.id, name: category.name, removed: false, variants: category.variants.map(variantDraft) };
}
export function catalogChanges(draft: CategoryDraft[], original: TicketCategory[], multiday: boolean): CatalogChanges
{
	const result: CatalogChanges = { categoryChanges: [], typeChanges: [] };
	for (const category of draft)
	{
		const previous = original.find(item => item.id == category.id);
		if (category.removed)
		{
			if (category.id) result.categoryChanges.push({ action: "delete", id: category.id });
			continue;
		}
		const name = multiday ? category.name : category.variants.find(variant => variant.selected)?.name ?? category.name;
		if (!category.id) result.categoryChanges.push({ action: "add", clientId: category.key, name });
		else if (multiday && name != previous?.name) result.categoryChanges.push({ action: "update", id: category.id, name });
		const categoryRef = category.id ? { id: category.id } : { clientId: category.key };
		for (const variant of category.variants)
		{
			const old = previous?.variants.find(item => item.id == variant.id);
			if (!variant.selected)
			{
				if (old && !old.deleted) result.typeChanges.push({ action: "delete", id: old.id });
				continue;
			}
			if (!old || old.deleted) result.typeChanges.push({ action: "add", categoryRef, dayOffsets: variant.dayOffsets, name: variant.name, price: variant.price, quantity: variant.quantity });
			if (old && (variant.name != old.name || variant.price != old.price || variant.quantity != old.quantity))
				result.typeChanges.push({ action: "update", id: old.id, ...(variant.name != old.name ? { name: variant.name } : {}), ...(variant.price != old.price ? { price: variant.price } : {}), ...(variant.quantity != old.quantity ? { quantity: variant.quantity } : {}) });
		}
	}
	return result;
}

export default function EditTicketTypesForm({ eventId, event, open, close }: EditTicketTypesFormProps)
{
	const catalog = useTicketCatalog(eventId);
	const draft = useStateObj<CategoryDraft[]>([]);
	const initialized = useRef<string | null>(null);
	const mutation = useMutationUpdateCatalog(eventId, close);
	const multiday = event.dayCount > 1;
	const { reset } = mutation;
	useEffect(() =>
	{
		const setDraft = draft.set;
		if (!open) { initialized.current = null; reset(); }
		else if (catalog.data && initialized.current != String(eventId))
		{
			setDraft(catalog.data.categories.map(categoryDraft));
			initialized.current = String(eventId);
		}
	}, [open, eventId, catalog.data, draft.set, reset]);
	const busy = mutation.isPending || !catalog.isSuccess;
	function patchCategory(key: string, patch: Partial<CategoryDraft>)
	{
		draft.set(previous => previous.map(category => category.key == key ? { ...category, ...patch } : category));
	}
	function patchVariant(key: string, index: number, patch: Partial<VariantDraft>)
	{
		draft.set(previous => previous.map(category => category.key == key ? { ...category, variants: category.variants.map((variant, i) => i == index ? { ...variant, ...patch } : variant) } : category));
	}
	function toggle(category: CategoryDraft, offsets: number[])
	{
		const index = category.variants.findIndex(variant => variant.dayOffsets.join(",") == offsets.join(","));
		if (index >= 0) patchVariant(category.key, index, { selected: !category.variants[index].selected });
		else
		{
			const suffix = offsets.length > 1 ? "оба" : event.days.find(day => day.dayOffset == offsets[0])?.date.slice(-2) ?? String(offsets[0] + 1);
			patchCategory(category.key, { variants: [...category.variants, { name: `${category.name} ${suffix}`.trim(), price: null, quantity: null, dayOffsets: offsets, selected: true }] });
		}
	}
	function add()
	{
		draft.set(previous => [...previous, { key: newRequestId(), name: "", removed: false, variants: multiday ? [] : [{ name: "", price: null, quantity: null, dayOffsets: [0], selected: true }] }]);
	}
	let rowNumber = 0;
	return <Popup open={open} close={close} title="Изменение видов билетов">
		{displayError(catalog)}{displayError(mutation)}
		{(catalog.isLoading || mutation.isPending) && <Spinner />}
		<Form className={`${styles.typesForm} ${!multiday ? styles.singleDay : ""}`} disabled={busy} onSubmit={() => mutation.mutate(catalogChanges(draft.v, catalog.data?.categories ?? [], multiday))}>
			{!draft.v.some(category => !category.removed) && <p className="muted">{multiday ? "Добавьте категорию, затем выберите варианты по дням и укажите их цены и лимиты." : "Добавьте вид билета, укажите его название, цену и лимит. Пустой лимит — без ограничений."}</p>}
			{!multiday && draft.v.some(category => !category.removed) && <div className={styles.typeLabels} aria-hidden="true"><span>Название</span><span>Цена, ₽</span><span>Лимит</span><span /></div>}
			{draft.v.filter(category => !category.removed).map(category => <div key={category.key} className={`${styles.category} ${multiday ? styles.categoryGroup : ""}`}>
				{multiday && <div className={styles.categoryHeader}>
					<label className={styles.categoryName}><span>Категория</span><input aria-label="Название категории" placeholder="Название категории" required value={category.name} disabled={busy} onChange={e => patchCategory(category.key, { name: e.target.value })} /></label>
					<button type="button" className="button button_small" disabled={busy} onClick={() => patchCategory(category.key, { removed: true })}>Удалить категорию</button>
					<div className={styles.variantChoices}><span className="muted">Варианты по дням:</span>{[[0], [1], [0, 1]].map(offsets => <label className="check-label" key={offsets.join(",")}><input type="checkbox" disabled={busy} checked={category.variants.some(variant => variant.dayOffsets.join(",") == offsets.join(",") && variant.selected)} onChange={() => toggle(category, offsets)} /><span>{offsets.length > 1 ? "Оба дня" : event.days.find(day => day.dayOffset == offsets[0]) ? calendarDayLabel(event.days.find(day => day.dayOffset == offsets[0])!.date) : `День ${offsets[0] + 1}`}</span></label>)}</div>
				</div>}
				{multiday && <div className={styles.typeLabels} aria-hidden="true"><span>Разновидность</span><span>Цена, ₽</span><span>Лимит</span><span /></div>}
				{category.variants.map((variant, index) =>
				{
					if (!variant.selected || (!multiday && variant.dayOffsets.some(offset => offset > 0))) return null;
					const number = ++rowNumber;
					return <div key={variant.id ?? `new-${index}`} className={styles.variant}>
						<div className={styles.typeRow}>
							<label className={`${styles.typeField} ${styles.variantName}`}><span>Название</span><input aria-label={`Название вида билета ${number}`} placeholder="Название" type="text" required value={variant.name} disabled={busy} onChange={e => patchVariant(category.key, index, { name: e.target.value })} /></label>
							<label className={styles.typeField}><span>Цена, ₽</span><input aria-label={`Цена вида билета ${number}`} type="number" min={0} step={1} placeholder="не указана" value={variant.price ?? ""} disabled={busy} onChange={e => patchVariant(category.key, index, { price: e.target.value == "" ? null : Number(e.target.value) })} /></label>
							<label className={styles.typeField}><span>Лимит</span><input aria-label={`Количество вида билета ${number}`} title="Пусто — без лимита" type="number" min={0} step={1} placeholder="без лимита" value={variant.quantity ?? ""} disabled={busy} onChange={e => patchVariant(category.key, index, { quantity: e.target.value == "" ? null : Number(e.target.value) })} /></label>
							<button type="button" className={`button ${styles.removeButton}`} aria-label={`Удалить вид билета ${number}`} disabled={busy} onClick={() => patchVariant(category.key, index, { selected: false })}>×</button>
						</div>
						{multiday && <small className={styles.variantDates}>Действует: <TicketDates dates={variant.dayOffsets.flatMap(offset => event.days.filter(day => day.dayOffset == offset).map(day => day.date))} /></small>}
					</div>;
				})}
			</div>)}
			<div className="actions"><button type="button" className="button button_small" disabled={busy} onClick={add}>＋ Добавить {multiday ? "категорию" : "вид"}</button></div>
			<div className="form-actions"><button type="button" className="button" onClick={close}>Отмена</button><button type="submit" className="button button_primary" disabled={busy}>Сохранить</button></div>
		</Form>
	</Popup>;
}

interface EditTicketTypesFormProps extends PopupProps { eventId: number | string; event: EventData; }
