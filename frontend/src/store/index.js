import { configureStore, combineReducers } from "@reduxjs/toolkit"
import BlankSlice from "./BlankSlice"

const store = configureStore({
	reducer: combineReducers({
		Blank: BlankSlice.reducer,
	}),
});

export default store;