import useStateObj from "../../utils/useStateObj";
import { useEffect } from "react";
import classNames from "../../utils/classNames";
import styles from "./styles.module.css";
import getCookie from "../../utils/getCookies";

let msg = "";
export default function MessageFromBackend()
{
	const message = useStateObj("");

	useEffect(() =>
	{
		const setMessage = message.set;
		const timer = setInterval(() =>
		{
			const msgCur = getMsg();
			if (msgCur != msg)
			{
				msg = msgCur || "";
				setMessage(msg);
			}
		}, 1000);
		return () =>
		{
			clearInterval(timer);
		};
	}, [message.set]);

	return (
		<div className={classNames(styles.root, message.v != "" && styles.visible)}>
			<button
				className={styles.close}
				onClick={() => message.set("")}
			></button>
			<div className={styles.message}>{trimQuotes(message.v)}</div>
		</div>
	);
}

function trimQuotes(str: string)
{
	if (str.at(0) == '"') str = str.slice(1);
	if (str.at(-1) == '"') str = str.slice(0, -1);
	return str;
}

function getMsg()
{
	return getCookie("MESSAGE_TO_FRONTEND");
}
