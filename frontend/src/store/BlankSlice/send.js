import BlankSlice from ".";

const SendBlank = data => async dispatch =>
{
	dispatch(BlankSlice.actions.startSending());

	try
	{
		const res = await fetch(`http://localhost:3000/blank`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		});

		if (res.status !== 200)
			throw new Error("status !== 200");

		// return dispatch(BlankSlice.actions.successSending(data));
		dispatch(BlankSlice.actions.successSending());
	}
	catch
	{
		dispatch(BlankSlice.actions.failSending())
	}
}

export default SendBlank;