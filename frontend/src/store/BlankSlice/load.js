import BlankSlice from ".";
import { selectBlankIsLoaded } from "./selectors"

const LoadBlank = async (dispatch, getState) =>
{
	const state = getState();
	if (selectBlankIsLoaded(state)) return;

	dispatch(BlankSlice.actions.startLoading());

	try
	{
		const res = await fetch(`http://localhost:3000/blank`);
		const data = await res.json();
		dispatch(BlankSlice.actions.successLoading(data));
	}
	catch
	{
		dispatch(BlankSlice.actions.failLoading());
	}
}

export default LoadBlank;
