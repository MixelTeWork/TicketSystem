export function dateToString(date: Date)
{
	return `${padNum(date.getDate(), 2)}.${padNum(date.getMonth() + 1, 2)}.${date.getFullYear()}`;
}

export function timeToString(date: Date, seconds = false)
{
	let dateStr = `${padNum(date.getHours(), 2)}:${padNum(date.getMinutes(), 2)}`;
	if (seconds) return dateStr + `:${padNum(date.getSeconds(), 2)}`;
	return dateStr;
}

export function datetimeToString(date: Date, seconds = false)
{
	return dateToString(date) + " " + timeToString(date, seconds);
}

export function relativeDate(date: Date, nowBreak: "second" | "minute" | "hour" | "day" = "second")
{
	const now = new Date();
	const dY = date.getFullYear() - now.getFullYear();
	const dM = date.getMonth() - now.getMonth();
	const dD = date.getDate() - now.getDate();
	const dh = date.getHours() - now.getHours();
	const dm = date.getMinutes() - now.getMinutes();
	const ds = date.getSeconds() - now.getSeconds();

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
	let [vChange, vNames] = getChange();

	if (typeof vChange == "string")
		return vChange;

	let relative = `${countWord(vChange, ...vNames)}`
	if (Math.abs(vChange) > 1) relative = Math.abs(vChange) + " " + relative;
	if (vChange > 0) relative = "Через " + relative;
	else relative += " назад";

	return relative;
}

export function secondsPast(date: Date)
{
	const now = new Date();
	return (now.getTime() - date.getTime()) / 1000;
}

function padNum(num: number, len: number)
{
	return `${num}`.padStart(len, "0");
}

function countWord(num: number, one: string, two: string, five: string)
{
	const numS = `${num}`;
	if (numS.at(-1) == "1" && numS.at(-2) != "1")
		return one;
	if (["2", "3", "4"].includes(numS.at(-1) || "") && numS.at(-2) != "1")
		return two;
	return five;
}
