import { useCallback, useMemo, useState } from "react";

export default function useStateObj<S>(initialState: S | (() => S)): StateObj<S>
{
	const [v, set] = useState(initialState);
	return useMemo(() => ({ v, set }), [v, set]);
}

export interface StateObj<S>
{
	v: S;
	set: React.Dispatch<React.SetStateAction<S>>;
}

export function useStateObjNull<S>(initialState: S | null | (() => S | null) = null): StateObjNullable<S | null>
{
	const state = useStateObj(initialState);
	const { set } = state;
	const setNull = useCallback(() => set(null), [set]);
	return useMemo(() => ({ ...state, setNull }), [state, setNull]);
}

export interface StateObjNullable<S> extends StateObj<S>
{
	setNull: () => void,
}
