import { expect, test } from "@playwright/test";
import { tauriMockInitScript } from "./mockTauri";

test.use({ viewport: { width: 420, height: 520 } });

test.beforeEach(async ({ page }) => {
	await page.addInitScript(tauriMockInitScript);
});

test("modal captures focus and restores it on close", async ({ page }) => {
	await page.goto("/");
	await page.locator("header button[title='New note']").click();
	await page.waitForTimeout(300);
	const editor = page.locator(".tiptap");
	await editor.click();

	await page.getByTitle("Note options").click();
	await page.getByText("Settings").click();
	await page.waitForTimeout(200);

	const inModal = await page.evaluate(() => {
		const modal = document.querySelector("[class*='max-w-lg']");
		return modal?.contains(document.activeElement) ?? false;
	});
	expect(inModal).toBe(true);

	await page.keyboard.press("Escape");
	await page.waitForTimeout(200);
	const modalGone = await page.evaluate(() => !document.querySelector("[class*='max-w-lg']"));
	expect(modalGone).toBe(true);

	// Focus returns to the editor after the modal closes.
	const editorFocused = await page.evaluate(() =>
		document.activeElement?.classList.contains("ProseMirror"),
	);
	expect(editorFocused).toBe(true);
});

test("typing resumes in the editor after closing settings", async ({ page }) => {
	await page.goto("/");
	await page.locator("header button[title='New note']").click();
	await page.waitForTimeout(300);
	const editor = page.locator(".tiptap");
	await editor.click();
	await editor.pressSequentially("before ");
	await page.waitForTimeout(1200); // let the debounced autosave flush

	await page.getByTitle("Note options").click();
	await page.getByText("Settings").click();
	await page.waitForTimeout(200);
	await page.keyboard.press("Escape");
	await page.waitForTimeout(300);

	await page.keyboard.type("after");
	await page.waitForTimeout(1200);

	const content = await page.evaluate(() => {
		const store = (window as unknown as { __store?: { notes: unknown[] } }).__store!;
		return (store.notes as Array<{ content: string }>)[0]?.content ?? "";
	});
	expect(content).toContain("before");
	expect(content).toContain("after");
});

test("no crash when toggling board view and pinning notes", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", (err) => errors.push(err.message));
	await page.goto("/");
	await page.locator("header button[title='New note']").click();
	await page.waitForTimeout(300);
	const editor = page.locator(".tiptap");
	await editor.click();
	await editor.pressSequentially("pin me note content");
	await page.waitForTimeout(1200);

	// Pin via the 3-dot menu
	await page.getByTitle("Note options").click();
	await page.getByText("Pin note").click();
	await page.waitForTimeout(400);

	// Verify content survived pinning (regression: pin used to wipe non-active content)
	const content = await page.evaluate(() => {
		const store = (window as unknown as { __store?: { notes: unknown[] } }).__store!;
		return (store.notes as Array<{ content: string }>)[0]?.content ?? "";
	});
	expect(content).toContain("pin me note content");

	// Switch to board view and back — no crash
	await page.getByTitle("Board", { exact: true }).click();
	await page.waitForTimeout(300);
	await expect(page.getByText("In Progress")).toBeVisible();
	await page.getByTitle("Notes", { exact: true }).click();
	await page.waitForTimeout(300);
	await expect(editor).toBeVisible();

	expect(errors).toEqual([]);
});
