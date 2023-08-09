export function padNum(num: number, len: number)
{
	return `${num}`.padStart(len, "0");
}

export function countWord(num: number, one: string, two: string, five: string)
{
	const numS = `${num}`;
	if (numS.at(-1) == "1" && numS.at(-2) != "1")
		return one;
	if (["2", "3", "4"].includes(numS.at(-1) || "") && numS.at(-2) != "1")
		return two;
	return five;
}
