import { useRef, useState } from "react";
import Layout from "../../components/Layout"
import Popup from "../../components/Popup";

export default function DebugPage()
{
	const [logErrors, setLogErrors] = useState("");
	const [log, setLog] = useState("");
	const refLogErrors = useRef<HTMLPreElement>(null);
	const refLog = useRef<HTMLPreElement>(null);

	return (
		<Layout centered gap="1rem">
			<button className="button" onClick={async () =>
			{
				setLogErrors("Loading");
				try
				{
					const res = await fetch("/api/debug/log_errors");
					const data = await res.text();
					setLogErrors(data);
					setTimeout(() => refLogErrors.current?.parentElement?.scrollTo(0, refLogErrors.current?.parentElement?.scrollHeight), 150);
				}
				catch (x) { setLogErrors(JSON.stringify(x)); }
			}}>log errors</button>
			<button className="button" onClick={async () =>
			{
				setLog("Loading");
				try
				{
					const res = await fetch("/api/debug/log");
					const data = await res.text();
					setLog(data);
					setTimeout(() => refLog.current?.parentElement?.scrollTo(0, refLog.current?.parentElement?.scrollHeight), 150);
				}
				catch (x) { setLog(JSON.stringify(x)); }
			}}>log</button>
			<Popup title="logErrors" open={logErrors != ""} close={() => setLogErrors("")}>
				<pre ref={refLogErrors}>{logErrors}</pre>
			</Popup>
			<Popup title="log" open={log != ""} close={() => setLog("")}>
				<pre ref={refLog}>{log}</pre>
			</Popup>
		</Layout>
	);
}
