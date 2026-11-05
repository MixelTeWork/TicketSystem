import { useCallback, useMemo } from "react";
import useStateObj, { type StateObj } from "./useStateObj";

export default function useStateBool(initialState: boolean | (() => boolean)): StateBool
{
	const state = useStateObj(initialState);
	const setT = useCallback(() =>
	{
		const set = state.set;
		return set(true);
	}, [state.set]);
	const setF = useCallback(() =>
	{
		const set = state.set;
		return set(false);
	}, [state.set]);
	const toggle = useCallback(() =>
	{
		const set = state.set;
		return set(v => !v);
	}, [state.set]);

	return useMemo(() => ({
		...state,
		setT,
		setF,
		toggle,
	}), [state, setT, setF, toggle]);
}

export interface StateBool extends StateObj<boolean>
{
	setT: () => void;
	setF: () => void;
	toggle: () => void;
}
