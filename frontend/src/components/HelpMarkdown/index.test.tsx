import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test } from "vitest";
import HelpMarkdown from ".";

afterEach(cleanup);

function show(markdown: string)
{
	return render(<MemoryRouter><HelpMarkdown articleId="entry-rules" markdown={markdown} /></MemoryRouter>);
}

test("renders Markdown, tables and exact system messages", () =>
{
	const view = show("## Проверка\n\nСообщение `Вход разрешён` и **важное** *слово*.\n\n1. Первый шаг\n2. Второй шаг\n\n| День | Вход |\n| --- | --- |\n| Первый | Один раз |\n\n[Другая статья](/help/scanner-merch)");
	expect(screen.getByRole("heading", { name: "Проверка" })).toBeTruthy();
	expect(screen.getByRole("table")).toBeTruthy();
	expect(screen.getAllByRole("listitem")).toHaveLength(2);
	expect(screen.getByText("Вход разрешён").tagName).toBe("CODE");
	expect(view.container.querySelector("strong")?.textContent).toBe("важное");
	expect(screen.getByRole("link", { name: "Другая статья" }).getAttribute("href")).toBe("/help/scanner-merch");
});

test("shows an author-supplied callout title and preserves body formatting", () =>
{
	show("> [!WARNING] Если пропала связь\n> Повторите **проверку**.\n>\n> Смотрите `результат`.");
	const block = screen.getByRole("note", { name: "Если пропала связь" });
	expect(within(block).getByText("Если пропала связь")).toBeTruthy();
	expect(within(block).getByText("проверку").tagName).toBe("STRONG");
	expect(within(block).getByText("результат").tagName).toBe("CODE");
	expect(block.textContent).not.toContain("[!WARNING]");
});

test("untitled callouts have no generated title or empty paragraph", () =>
{
	show("> [!NOTE]\n> Ссылка сама по себе доступа не даёт.");
	const block = screen.getByRole("note");
	expect(block.hasAttribute("aria-labelledby")).toBe(false);
	expect(block.querySelectorAll("p")).toHaveLength(1);
	expect(block.textContent?.trim()).toBe("Ссылка сама по себе доступа не даёт.");
	expect(screen.queryByText("Примечание")).toBeNull();
});

test("supports a separately spaced body, inline title formatting and ordinary quotes", () =>
{
	const view = show("> [!WARNING] Введите `полный код`\n>\n> Первый абзац.\n>\n> Второй абзац.\n\n> Обычная цитата.\n\n> [!OTHER] Неизвестный тип\n> Текст.");
	expect(screen.getByRole("note", { name: "Введите полный код" }).querySelectorAll("p")).toHaveLength(3);
	expect(view.container.querySelectorAll("blockquote")).toHaveLength(2);
});

test("does not render raw HTML or executable link protocols", () =>
{
	const view = show('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[опасно](javascript:alert%281%29) [данные](data:text/html,test) [обход](//evil.example) [скрыто](java&#x73;cript:alert%281%29)');
	expect(view.container.querySelector("script")).toBeNull();
	expect(view.container.querySelector("img")).toBeNull();
	expect(view.container.querySelector("[onerror]")).toBeNull();
	expect(view.container.querySelectorAll("a")).toHaveLength(0);
});

test("serves illustrations only through the current article's protected endpoint", () =>
{
	show("![Результат проверки](assets/result.png)\n\n![Трекер](https://evil.example/image.png)\n\n![Чужая статья](/api/help/articles/private/assets/result.png)\n\n![Обход](assets/../secret.png)");
	expect(screen.getAllByRole("img")).toHaveLength(1);
	expect(screen.getByRole("img", { name: "Результат проверки" }).getAttribute("src")).toBe("/api/help/articles/entry-rules/assets/result.png");
});

test("external links open safely and footnote references remain usable", () =>
{
	show("[Сайт](https://example.test/help)\n\nСноска[^one].\n\n[^one]: Пояснение.");
	const external = screen.getByRole("link", { name: "Сайт" });
	expect(external.getAttribute("target")).toBe("_blank");
	expect(external.getAttribute("rel")).toContain("noopener");
	const reference = screen.getByRole("link", { name: "1" });
	expect(reference.getAttribute("href")).toMatch(/^#user-content-fn-/);
	expect(reference.id).toBe("user-content-fnref-one");
	expect(reference.getAttribute("aria-describedby")).toBe("footnote-label");
});
