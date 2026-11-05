import type { StateObj } from "../../utils/useStateObj";
import type { TicketType } from "../../api/ticketTypes";
import { FormField } from "../Form";
import type { TicketFormValues } from "./values";
import TicketDates from "../TicketDates";
import { calendarDayLabel } from "../../utils/multiday";

export default function TicketFormFields({ values, ticketTypes, resetPriceOnTypeChange = false, pricePlaceholder }: TicketFormFieldsProps)
{
	function change(patch: Partial<TicketFormValues>)
	{
		values.set(previous => ({ ...previous, ...patch }));
	}

	return <>
		<FormField label="Тип билета">
			<select aria-label="Тип билета" value={values.v.typeId} onChange={e =>
			{
				const typeId = Number(e.target.value);
				const type = ticketTypes?.find(type => type.id == typeId);
				change({ typeId, ...(resetPriceOnTypeChange && type ? { price: `${type.price ?? ""}` } : {}) });
			}} disabled={ticketTypes?.length == 0} required>
				{ticketTypes?.map(type => <option key={type.id} value={type.id}>{type.name}{type.validDates.length ? ` · ${type.validDates.map(calendarDayLabel).join(", ")}` : ""}</option>)}
			</select>
			<TicketDates dates={ticketTypes?.find(type => type.id == values.v.typeId)?.validDates} />
			{ticketTypes?.length == 0 && <h4>Добавьте типы билетов</h4>}
		</FormField>
		<FormField label="Посетитель">
			<input value={values.v.personName} onChange={e => change({ personName: e.target.value })} type="text" required />
		</FormField>
		<FormField label="Ссылка на посетителя">
			<input value={values.v.personLink} onChange={e => change({ personLink: e.target.value })} type="text" />
		</FormField>
		<FormField label="Промокод">
			<input value={values.v.promocode} onChange={e => change({ promocode: e.target.value })} type="text" />
		</FormField>
		<FormField label="Цена (в рублях)">
			<input value={values.v.price} placeholder={pricePlaceholder} onChange={e =>
			{
				const price = parseInt(e.target.value, 10);
				change({ price: isFinite(price) ? `${price}` : "" });
			}} type="text" />
		</FormField>
	</>;
}

interface TicketFormFieldsProps
{
	values: StateObj<TicketFormValues>;
	ticketTypes?: TicketType[];
	resetPriceOnTypeChange?: boolean;
	pricePlaceholder?: string;
}
