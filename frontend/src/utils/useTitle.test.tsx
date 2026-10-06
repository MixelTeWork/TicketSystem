import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useTitle } from "./useTitle";

afterEach(() =>
{
	cleanup();
	vi.restoreAllMocks();
});

test("updates the title only when its text changes and restores the previous title", () =>
{
	document.title = "Previous";
	const setTitle = vi.spyOn(document, "title", "set");
	const view = renderHook(({ name }) => useTitle([name, "Билеты"]), { initialProps: { name: "Event" } });
	expect(document.title).toBe("Билетная система | Event | Билеты");
	view.rerender({ name: "Event" });
	expect(setTitle).toHaveBeenCalledTimes(1);
	view.rerender({ name: "Renamed" });
	expect(document.title).toBe("Билетная система | Renamed | Билеты");
	view.unmount();
	expect(document.title).toBe("Previous");
});
