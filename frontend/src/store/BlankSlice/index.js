import { createSlice } from "@reduxjs/toolkit";
import Statuses from "../../utils/Statuses";

const initialState = {
	value: null,
	statusLoad: Statuses.idle,
	statusSend: Statuses.idle,
}

const BlankSlice = createSlice({
	name: "Blank",
	initialState,
	reducers: {
		startLoading: state =>
		{
			state.statusLoad = Statuses.inProgress;
		},
		successLoading: (state, action) =>
		{
			state.statusLoad = Statuses.success;
			state.value = action.payload;
		},
		failLoading: state =>
		{
			state.statusLoad = Statuses.failed;
		},
		startSending: state =>
		{
			state.statusSend = Statuses.inProgress;
		},
		// successSending: (state, action) =>
		// {
		// 	state.statusSend = Statuses.success;
		// 	state.value = [action.payload, ...state.value];
		// },
		successSending: state =>
		{
			state.statusSend = Statuses.success;
		},
		failSending: state =>
		{
			state.statusSend = Statuses.failed;
		},
	},
})

export default BlankSlice;