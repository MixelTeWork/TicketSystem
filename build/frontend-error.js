{
	async function sendError(data)
	{
		try
		{
			await fetch("/api/frontend_error", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
		}
		catch { }
	}

	window.addEventListener("error", event =>
	{
		void sendError({
			msg: event.message,
			url: event.filename,
			line: event.lineno,
			col: event.colno,
			error: event.error instanceof Error
				? { message: event.error.message, stack: event.error.stack }
				: event.error,
		});
	});

	window.addEventListener("unhandledrejection", event =>
	{
		const reason = event.reason;
		void sendError({
			message: reason?.message ?? String(reason),
			stack: reason?.stack,
		});
	});
}
