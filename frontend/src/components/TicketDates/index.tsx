import useStateBool from "../../utils/useStateBool";
import { calendarDate, calendarDayLabel } from "../../utils/multiday";

export default function TicketDates({ dates }: { dates?: string[] })
{
	const expanded = useStateBool(false);
	if (!dates?.length) return null;
	const full = dates.map(date => calendarDate(date, true)).join(", ");
	return <span tabIndex={0} role="button" aria-expanded={expanded.v} title={full} onClick={event => { event.preventDefault(); expanded.setT(); }} onFocus={expanded.setT} onBlur={expanded.setF} onKeyDown={event => { if (event.key == "Enter" || event.key == " ") { event.preventDefault(); expanded.setT(); } }} style={{ whiteSpace: "nowrap" }}>
		{expanded.v ? full : dates.map(calendarDayLabel).join(", ")}
	</span>;
}
