import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import MessageFromBackend from ".";

function setMessage(text: string)
{
	document.cookie = `MESSAGE_TO_FRONTEND=${encodeURIComponent(text)}; path=/`;
}

afterEach(() =>
{
	cleanup();
	document.cookie = "MESSAGE_TO_FRONTEND=; Max-Age=0; path=/";
	vi.useRealTimers();
});

test("shows the initial decoded message as plain text, including literal quotes", () =>
{
	setMessage('"Скоро обновление" <b>системы</b>');
	render(<MessageFromBackend />);
	expect(screen.getByRole("status").textContent).toBe('"Скоро обновление" <b>системы</b>');
	expect(screen.getByRole("status").querySelector("b")).toBeNull();
});

test("keeps a dismissed message closed, shows changed messages and clears empty messages", () =>
{
	vi.useFakeTimers();
	render(<MessageFromBackend />);
	expect(screen.queryByRole("status")).toBeNull();
	setMessage("Первое сообщение");
	act(() => vi.advanceTimersByTime(1000));
	expect(screen.getByRole("status").textContent).toBe("Первое сообщение");
	fireEvent.click(screen.getByRole("button", { name: "Закрыть сообщение" }));
	act(() => vi.advanceTimersByTime(2000));
	expect(screen.queryByRole("status")).toBeNull();
	setMessage("Новое сообщение");
	act(() => vi.advanceTimersByTime(1000));
	expect(screen.getByRole("status").textContent).toBe("Новое сообщение");
	setMessage("");
	act(() => vi.advanceTimersByTime(1000));
	expect(screen.queryByRole("status")).toBeNull();
});

test("survives StrictMode remounts and cleans up polling", () =>
{
	vi.useFakeTimers();
	setMessage("Сообщение");
	const view = render(<StrictMode><MessageFromBackend /></StrictMode>);
	expect(screen.getByRole("status").textContent).toBe("Сообщение");
	expect(vi.getTimerCount()).toBe(1);
	view.unmount();
	expect(vi.getTimerCount()).toBe(0);
	render(<MessageFromBackend />);
	expect(screen.getByRole("status").textContent).toBe("Сообщение");
});
