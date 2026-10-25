import { countWord, padNum } from "./nums";

const moscowOffset = 3 * 60 * 60 * 1000;

// MySQL DATETIME and Moscow display must both stay within years 1000–9999.
export const EVENT_DATE_MIN = "1000-01-01T03:00:00";
export const EVENT_DATE_MAX = "9999-12-31T23:59:59";

export function parseUtcDate(value: string)
{
	return new Date(/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/.test(value) ? value.replace(" ", "T") + "Z" : value);
}

export function datetimeToInput(date: Date | undefined)
{
	return date ? new Date(date.getTime() + moscowOffset).toISOString().slice(0, 19) : "";
}

export function inputToUtc(value: string)
{
	return new Date(value + "+03:00").toISOString();
}

export function dateToString(date: Date | null | undefined, reverse = false, year = true)
{
	if (!date) return "";
	const moscow = new Date(date.getTime() + moscowOffset);
	const nums = [padNum(moscow.getUTCDate(), 2), padNum(moscow.getUTCMonth() + 1, 2)];
	if (year) nums.push(`${moscow.getUTCFullYear()}`);
	if (reverse) nums.reverse();
	return nums.join(".");
}

export function timeToString(date: Date, seconds = false)
{
	const moscow = new Date(date.getTime() + moscowOffset);
	const dateStr = `${padNum(moscow.getUTCHours(), 2)}:${padNum(moscow.getUTCMinutes(), 2)}`;
	if (seconds) return dateStr + `:${padNum(moscow.getUTCSeconds(), 2)}`;
	return dateStr;
}

export function datetimeToString(date: Date, seconds = false, reverseDate = false)
{
	return dateToString(date, reverseDate) + " " + timeToString(date, seconds);
}

export function relativeDate(date: Date, nowBreak: "second" | "minute" | "hour" | "day" = "second")
{
	const now = new Date();

	const delta = date.getTime() - now.getTime();
	let d = Math.floor(Math.abs(delta) / 1000);

	const dY = Math.floor(d / (60 * 60 * 24 * 30 * 12)); d -= dY * 60 * 60 * 24 * 30 * 12;
	const dM = Math.floor(d / (60 * 60 * 24 * 30)); d -= dM * 60 * 60 * 24 * 30;
	const dD = Math.floor(d / (60 * 60 * 24)); d -= dD * 60 * 60 * 24;
	const dh = Math.floor(d / (60 * 60)) % 24; d -= dh * 60 * 60;
	const dm = Math.floor(d / 60) % 60; d -= dm * 60;
	const ds = d % 60;

	function getChange(): [string | number, [string, string, string]]
	{
		const sv = (v: string) => [v, ["", "", ""]] as [string, [string, string, string]];
		if (dY != 0) return [dY, ["год", "года", "лет"]];
		if (dM != 0) return [dM, ["месяц", "месяца", "месяцов"]];
		if (dD != 0) return [dD, ["день", "дня", "дней"]];
		if (nowBreak == "day") return sv("Сегодня");
		if (dh != 0) return [dh, ["час", "часа", "часов"]];
		if (nowBreak == "hour") return sv("Сейчас");
		if (dm != 0) return [dm, ["минута", "минуты", "минут"]];
		if (nowBreak == "minute") return sv("Сейчас");
		if (ds != 0) return [ds, ["секунда", "секунды", "секунд"]];
		return sv("Только что");
	}
	const [vChange, vNames] = getChange();

	if (typeof vChange == "string")
		return vChange;

	let relative = `${countWord(vChange, ...vNames)}`;
	if (Math.abs(vChange) > 1) relative = Math.abs(vChange) + " " + relative;
	if (delta > 0) relative = "Через " + relative;
	else relative += " назад";

	return relative;
}

export function secondsPast(date: Date)
{
	const now = new Date();
	return (now.getTime() - date.getTime()) / 1000;
}
