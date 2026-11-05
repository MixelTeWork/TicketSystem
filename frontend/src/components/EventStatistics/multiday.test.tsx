import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import EventStatistics, { EventTotals, totalStats } from ".";
import { parseTicketStats, type TicketStats } from "../../api/tickets";
import type { EventData } from "../../api/events";

afterEach(cleanup);
const event: EventData = { id: 7, name: "Два дня", date: "2026-10-20", active: true, endDate: "2026-10-21", dayCount: 2, days: [{ id: 1, dayOffset: 0, date: "2026-10-20" }, { id: 2, dayOffset: 1, date: "2026-10-21" }] };
const rows: TicketStats[] = [
	{ categoryId: 10, categoryName: "Стандартная категория", price: null, deleted: false, categoryDeleted: false, validDates: [], typeId: 1, name: "Первый", count: 100, scanned: 80, checkinCount: 80, merchIssued: 70, authOnPltf: 0, dayOffsets: [0], byDay: [{ eventDayId: 1, dayOffset: 0, date: "2026-10-20", checkedIn: 80, eligible: 100 }, { eventDayId: 2, dayOffset: 1, date: "2026-10-21", checkedIn: 0, eligible: 0 }] },
	{ categoryId: 10, categoryName: "Стандартная категория", price: null, deleted: false, categoryDeleted: false, validDates: [], typeId: 2, name: "Второй", count: 60, scanned: 45, checkinCount: 45, merchIssued: 35, authOnPltf: 0, dayOffsets: [1], byDay: [{ eventDayId: 1, dayOffset: 0, date: "2026-10-20", checkedIn: 0, eligible: 0 }, { eventDayId: 2, dayOffset: 1, date: "2026-10-21", checkedIn: 45, eligible: 60 }] },
	{ categoryId: 20, categoryName: "Дополнительная категория", price: null, deleted: false, categoryDeleted: false, validDates: [], typeId: 3, name: "Оба", count: 40, scanned: 35, checkinCount: 55, merchIssued: 28, authOnPltf: 0, dayOffsets: [0, 1], byDay: [{ eventDayId: 1, dayOffset: 0, date: "2026-10-20", checkedIn: 30, eligible: 40 }, { eventDayId: 2, dayOffset: 1, date: "2026-10-21", checkedIn: 25, eligible: 40 }] },
];
test("uses eligible visits as denominator and counts used tickets separately", () =>
{
	expect(totalStats(rows)).toMatchObject({ count: 200, scanned: 160, checkins: 180, eligible: 240, merch: 133 });
	render(<><EventTotals rows={rows} event={event} /><EventStatistics event={event} rows={rows} types={[]} canEdit={false} edit={vi.fn()} /></>);
	expect(screen.getByText("Проходов", { exact: false }).textContent).toContain("180 (75%)");
	const total = screen.getByText("Всего").closest("tr")!;
	expect(within(total).getByText("(78%)")).toBeTruthy();
	expect(within(total).getByText("(70%)")).toBeTruthy();
	expect(within(total).getByText("(66%)")).toBeTruthy();
});
test("shows historical visits with no current eligibility and hides the deleted design action", () =>
{
	const deleted = { ...rows[0], deleted: true, count: 1, byDay: [{ eventDayId: 1, dayOffset: 0, date: "2026-10-20", checkedIn: 2, eligible: 1 }, { eventDayId: 2, dayOffset: 1, date: "2026-10-21", checkedIn: 1, eligible: 0 }] };
	render(<EventStatistics event={event} rows={[deleted]} types={[{ id: 1, categoryId: 1, name: "Первый", price: 0, imageId: null, pattern: null, quantity: null, dayOffsets: [0], validDates: ["2026-10-20"] }]} canEdit edit={vi.fn()} />);
	expect(screen.getByText("Первый (удалён)")).toBeTruthy();
	expect(screen.getAllByText("(200%)")).toHaveLength(2);
	expect(screen.queryByRole("button", { name: "Создать" })).toBeNull();
	expect(screen.getAllByText("(—)")).toHaveLength(2);
});

test("keeps an explicit empty or zero stats price when the catalog cache is older", () =>
{
	const types = [1, 2].map(id => ({ id, categoryId: 1, name: "Старое имя", price: 500, imageId: null, pattern: null, quantity: null, dayOffsets: [id - 1], validDates: [] }));
	render(<EventStatistics event={event} rows={[rows[0], { ...rows[1], price: 0 }]} types={types} canEdit={false} edit={vi.fn()} />);
	expect(within(screen.getByText("Первый").closest("tr")!).getAllByRole("cell")[1].textContent).toBe("—");
	expect(within(screen.getByText("Второй").closest("tr")!).getAllByRole("cell")[1].textContent).toBe("0 ₽");
});

test("distinguishes an eligible day with no issued tickets from a day outside the variant", () =>
{
	const empty = { ...rows[0], count: 0, scanned: 0, checkinCount: 0, merchIssued: 0, byDay: rows[0].byDay.map(day => ({ ...day, checkedIn: 0, eligible: 0 })) };
	render(<EventStatistics event={event} rows={[empty]} types={[]} canEdit={false} edit={vi.fn()} />);
	const cells = within(screen.getByText("Первый").closest("tr")!).getAllByRole("cell");
	expect(cells[3].textContent).toBe("0 (—)");
	expect(cells[4].textContent).toBe("—");
});

test("groups actual categories and retains deleted history without changing totals", () =>
{
	const history = { ...rows[2], categoryDeleted: true, deleted: true };
	render(<EventStatistics event={event} rows={[rows[0], rows[1], history]} types={[]} canEdit={false} edit={vi.fn()} />);
	const standard = screen.getByText("Стандартная категория").closest("tbody")!;
	expect(within(standard).getByText("Первый")).toBeTruthy();
	expect(within(standard).getByText("Второй")).toBeTruthy();
	expect(within(standard).queryByText("Оба (удалён)")).toBeNull();
	const deleted = screen.getByText("Дополнительная категория (удалена)").closest("tbody")!;
	expect(within(deleted).getByText("Оба (удалён)")).toBeTruthy();
	expect(within(screen.getByText("Всего").closest("tr")!).getByText("200", { exact: false }).textContent).toBe("200 (100%)");
	expect(screen.getByRole("columnheader", { name: "Вход 20 окт" })).toBeTruthy();
});

test("single-day statistics keep the compact flat list", () =>
{
	render(<EventStatistics event={{ ...event, dayCount: 1, endDate: event.date, days: event.days.slice(0, 1) }} rows={[rows[0]]} types={[]} canEdit={false} edit={vi.fn()} />);
	expect(screen.getByText("Первый")).toBeTruthy();
	expect(screen.queryByText("Стандартная категория")).toBeNull();
});

test.each([{ categoryId: undefined }, { categoryId: "10" }, { categoryId: 1.5 }, { categoryName: undefined }, { categoryName: null }])("rejects incomplete or invalid category DTO metadata: %j", fields =>
{
	expect(() => parseTicketStats([{ ...rows[0], ...fields } as unknown as TicketStats])).toThrow("Некорректный ответ статистики");
});
