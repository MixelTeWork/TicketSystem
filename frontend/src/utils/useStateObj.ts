import { useCallback, useMemo, useState } from "react";

export default function useStateObj<S>(initialState: S | (() => S), onSet?: (v: S, pv: S) => void): StateObj<S>
{
	const [v, set] = useState(initialState);
	const setWithCallback = useCallback<React.Dispatch<React.SetStateAction<S>>>(value =>
	{
		set(previous =>
		{
			const next = value instanceof Function ? value(previous) : value;
			onSet?.(next, previous);
			return next;
		});
	}, [onSet]);
	const setFn = onSet ? setWithCallback : set;

	return useMemo(() => ({
		v,
		set: setFn,
		setSilent: set,
	}), [v, setFn, set]);
}

export interface StateObj<S>
{
	v: S;
	set: React.Dispatch<React.SetStateAction<S>>;
	setSilent: React.Dispatch<React.SetStateAction<S>>;
}

export function useStateObjNull<S, T = S | null>(initialState: T | (() => T) = null as T, onSet?: (v: T, pv: T) => void): StateObjNullable<T>
{
	const state = useStateObj(initialState, onSet);
	const setNull = useCallback(() =>
	{
		const set = state.set;
		return set(null as T);
	}, [state.set]);
	return useMemo(() => ({ ...state, setNull }), [state, setNull]);
}

export function useStateList<T>(initialState: T[] | (() => T[]) = [] as T[], onSet?: (v: T[], pv: T[]) => void): StateList<T>
{
	const state = useStateObj(initialState, onSet);
	const setI = useCallback((i: number, v: T) =>
	{
		const set = state.set;
		return set(old =>
		{
			const list = [...old];
			list[i] = v;
			return list;
		});
	}, [state.set]);
	const push = useCallback((v: T, i?: number) =>
	{
		const set = state.set;
		return set(old =>
		{
			const list = [...old];
			if (i != undefined) list.splice(i, 0, v);
			else list.push(v);
			return list;
		});
	}, [state.set]);
	const pop = useCallback((i?: number) =>
	{
		const set = state.set;
		return set(old =>
		{
			const list = [...old];
			if (i != undefined) list.splice(i, 1);
			else list.pop();
			return list;
		});
	}, [state.set]);
	return useMemo(() => ({ ...state, setI, push, pop }), [state, setI, push, pop]);
}

export interface StateObjNullable<S> extends StateObj<S>
{
	setNull: () => void,
}

export interface StateList<T> extends StateObj<T[]>
{
	setI: (i: number, v: T) => void,
	push: (v: T, i?: number) => void,
	pop: (i?: number) => void,
}
