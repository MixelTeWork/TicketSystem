import { useRef, useState } from "react";
import Layout from "../../components/Layout"
import Popup from "../../components/Popup";
import { Link } from "react-router-dom";
import { useHasPermission } from "../../api/operations";

export default function DebugPage()
{
	const [log, setLog] = useState("");
	const [logTitle, setLogTitle] = useState("Log");
	const refLog = useRef<HTMLPreElement>(null);

	const viewLog = (title: string, path: string) => async () =>
	{
		setLogTitle(title)
		setLog("Loading");
		try
		{
			const res = await fetch(path);
			const data = await res.text();
			setLog(data);
			setTimeout(() => refLog.current?.parentElement?.scrollTo(0, refLog.current?.parentElement?.scrollHeight), 150);
		}
		catch (x) { setLog(JSON.stringify(x)); }
	}

	return (
		<Layout centered gap="1rem">
			{useHasPermission("page_debug_users") && <Link to="/d/users" className="button">Users</Link>}
			{useHasPermission("page_debug_events") && <Link to="/d/events" className="button">Events</Link>}
			<Link to="/d/log" className="button">Log</Link>
			<button onClick={viewLog("Log errors", "/api/debug/log_errors")}>Log errors</button>
			<button onClick={viewLog("Log info", "/api/debug/log_info")}>Log info</button>
			<button onClick={viewLog("Log requests", "/api/debug/log_requests")}>Log requests</button>
			<button onClick={viewLog("Log frontend", "/api/debug/log_frontend")}>Log frontend</button>
			<Popup title={logTitle} open={log != ""} close={() => setLog("")}>
				<pre ref={refLog}>{log}</pre>
			</Popup>
		</Layout>
	);
}
