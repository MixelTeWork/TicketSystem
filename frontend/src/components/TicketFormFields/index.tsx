import type { Dispatch, SetStateAction } from "react";
import type { TicketType } from "../../api/ticketTypes";
import { FormField } from "../Form";
import type { TicketFormValues } from "./values";

export default function TicketFormFields({ values, setValues, ticketTypes, resetPriceOnTypeChange = false, pricePlaceholder }: TicketFormFieldsProps)
{
	function change(values: Partial<TicketFormValues>)
	{
		setValues(previous => ({ ...previous, ...values }));
	}

	return <>
		<FormField label="Тип билета">
			<select value={values.typeId} onChange={e =>
			{
				const typeId = Number(e.target.value);
				const type = ticketTypes?.find(type => type.id == typeId);
				change({ typeId, ...(resetPriceOnTypeChange && type ? { price: `${type.price ?? ""}` } : {}) });
			}} disabled={ticketTypes?.length == 0} required>
				{ticketTypes?.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
			</select>
			{ticketTypes?.length == 0 && <h4>Добавьте типы билетов</h4>}
		</FormField>
		<FormField label="Посетитель">
			<input value={values.personName} onChange={e => change({ personName: e.target.value })} type="text" required />
		</FormField>
		<FormField label="Ссылка на посетителя">
			<input value={values.personLink} onChange={e => change({ personLink: e.target.value })} type="text" />
		</FormField>
		<FormField label="Промокод">
			<input value={values.promocode} onChange={e => change({ promocode: e.target.value })} type="text" />
		</FormField>
		<FormField label="Цена (в рублях)">
			<input value={values.price} placeholder={pricePlaceholder} onChange={e =>
			{
				const price = parseInt(e.target.value, 10);
				change({ price: isFinite(price) ? `${price}` : "" });
			}} type="text" />
		</FormField>
	</>;
}

interface TicketFormFieldsProps
{
	values: TicketFormValues;
	setValues: Dispatch<SetStateAction<TicketFormValues>>;
	ticketTypes?: TicketType[];
	resetPriceOnTypeChange?: boolean;
	pricePlaceholder?: string;
}
