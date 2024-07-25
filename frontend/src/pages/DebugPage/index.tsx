import { useRef, useState } from "react";
import Layout from "../../components/Layout"
import Popup from "../../components/Popup";
import { Link } from "react-router-dom";
import { useHasPermission } from "../../api/operations";

export default function DebugPage()
{
	const [logErrors, setLogErrors] = useState("");
	const [log, setLog] = useState("");
	const refLogErrors = useRef<HTMLPreElement>(null);
	const refLog = useRef<HTMLPreElement>(null);

	return (
		<Layout centered gap="1rem">
			{useHasPermission("page_debug_users") && <Link to="/d/users" className="button">Users</Link>}
			{useHasPermission("page_debug_events") && <Link to="/d/events" className="button">Events</Link>}
			<Link to="/d/log" className="button">Log</Link>
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
			}}>Log errors</button>
			<button className="button" onClick={async () =>
			{
				setLog("Loading");
				try
				{
					const res = await fetch("/api/debug/log_info");
					const data = await res.text();
					setLog(data);
					setTimeout(() => refLog.current?.parentElement?.scrollTo(0, refLog.current?.parentElement?.scrollHeight), 150);
				}
				catch (x) { setLog(JSON.stringify(x)); }
			}}>Log requests</button>
			<Popup title="logErrors" open={logErrors != ""} close={() => setLogErrors("")}>
				<pre ref={refLogErrors}>{logErrors}</pre>
			</Popup>
			<Popup title="log" open={log != ""} close={() => setLog("")}>
				<pre ref={refLog}>{log}</pre>
			</Popup>
		</Layout>
	);
}
