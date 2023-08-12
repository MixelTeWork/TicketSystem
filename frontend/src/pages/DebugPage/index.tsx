import { useRef, useState } from "react";
import Layout from "../../components/Layout"
import Popup from "../../components/Popup";

export default function DebugPage()
{
	const [logErrors, setLogErrors] = useState("");
	const [log, setLog] = useState("");
	const [clearRes, setClearRes] = useState("");
	const [clearPopup, setClearPopup] = useState(0);
	const clearEventIdInp = useRef<HTMLInputElement>(null);

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
				}
				catch (x) { setLog(JSON.stringify(x)); }
			}}>log</button>
			<button className="button" onClick={() => setClearPopup(1)}>Clear 'scanned'</button>
			<Popup title="Clear 'scanned'" open={clearPopup > 0} close={() => setClearPopup(0)}>
				<div>
					<input ref={clearEventIdInp} type="number" />
				</div>
				<button style={{ marginTop: "2rem" }} onClick={async () =>
				{
					if (!clearEventIdInp.current)
						return
					if (clearPopup < 5)
					{
						setClearPopup(v => v + 1);
						return
					}
					setClearPopup(0);
					setClearRes("Loading")
					const res = await fetch("/api/debug/clear_scanned/" + clearEventIdInp.current.value);
					const data = await res.text();
					setClearRes(data);
				}}>Confirm</button>
				<span>Press {6 - clearPopup} times</span>
			</Popup>
			<Popup title="Clear 'scanned'" open={clearRes != ""} close={() => setClearRes("")}>
				<pre>{clearRes}</pre>
			</Popup>
			<Popup title="logErrors" open={logErrors != ""} close={() => setLogErrors("")}>
				<pre>{logErrors}</pre>
			</Popup>
			<Popup title="log" open={log != ""} close={() => setLog("")}>
				<pre>{log}</pre>
			</Popup>
		</Layout>
	);
}
