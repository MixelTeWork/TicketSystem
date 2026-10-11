import useStateObj from "../../utils/useStateObj";
import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import Layout from "../../components/Layout";
import Popup from "../../components/Popup";
import { Link } from "react-router-dom";
import { fetchGet } from "../../utils/fetch";
import { useHasPermission } from "../../api/operations";

export default function DebugPage()
{
	const log = useStateObj("");
	const logTitle = useStateObj("Log");
	const refLog = useRef<HTMLPreElement>(null);
	const mutation = useMutation({
		mutationFn: async (path: string) => (await fetchGet(path)).text(),
		onSuccess: data =>
		{
			log.set(data);
			setTimeout(() => refLog.current?.parentElement?.scrollTo(0, refLog.current?.parentElement?.scrollHeight), 150);
		},
		onError: error => { log.set(error instanceof Error ? error.message : "Ошибка загрузки журнала"); },
	});

	const viewLog = (title: string, path: string) => () =>
	{
		logTitle.set(title);
		log.set("Loading");
		mutation.mutate(path);
	};

	return (
		<Layout centered gap="1rem">
			{useHasPermission("page_debug_users") && <Link to="/d/users" className="button">Users</Link>}
			{useHasPermission("page_debug_events") && <Link to="/d/events" className="button">Events</Link>}
			<Link to="/d/log" className="button">Log</Link>
			<button onClick={viewLog("Log errors", "/api/debug/log_errors")}>Log errors</button>
			<button onClick={viewLog("Log info", "/api/debug/log_info")}>Log info</button>
			<button onClick={viewLog("Log requests", "/api/debug/log_requests")}>Log requests</button>
			<button onClick={viewLog("Log frontend", "/api/debug/log_frontend")}>Log frontend</button>
			<Popup title={logTitle.v} open={log.v != ""} close={() => log.set("")}>
				<pre ref={refLog}>{log.v}</pre>
			</Popup>
		</Layout>
	);
}
