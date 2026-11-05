import { useEffect } from "react";
import getCookie from "../../utils/getCookies";
import useStateObj from "../../utils/useStateObj";
import styles from "./styles.module.css";

export default function MessageFromBackend()
{
	const message = useStateObj(() => ({ text: getCookie("MESSAGE_TO_FRONTEND") || "", visible: true }));
	const { set } = message;

	useEffect(() =>
	{
		const timer = setInterval(() =>
		{
			const text = getCookie("MESSAGE_TO_FRONTEND") || "";
			set(previous => previous.text == text ? previous : { text, visible: true });
		}, 1000);
		return () => clearInterval(timer);
	}, [set]);

	if (!message.v.text || !message.v.visible) return null;

	return <div className={styles.root} role="status">
		<button
			className={styles.close}
			aria-label="Закрыть сообщение"
			onClick={() => set(previous => ({ ...previous, visible: false }))}
		/>
		<div className={styles.message}>{message.v.text}</div>
	</div>;
}
