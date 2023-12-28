import { useEffect, useState } from "react";
import classNames from "../../utils/classNames";
import styles from "./styles.module.css"
import getCookie from "../../utils/getCookies";

let msg = "";
export default function MessageFromBackend()
{
	const [message, setMessage] = useState("");

	useEffect(() =>
	{
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
		}
	}, [setMessage])

	return (
		<div className={classNames(styles.root, message != "" && styles.visible)}>
			<button
				className={styles.close}
				onClick={() => setMessage("")}
			></button>
			<div className={styles.message}>{trimQuotes(message)}</div>
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
