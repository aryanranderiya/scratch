import { type Page, expect, test } from "@playwright/test";
import { primeConfig, tauriMockInitScript } from "./mockTauri";

test.use({ viewport: { width: 420, height: 520 } });

test.beforeEach(async ({ page }) => {
	await page.addInitScript(tauriMockInitScript);
});

function newNoteButton(page: Page) {
	return page.locator("header button[title='New note']");
}

test("boots into the compact scratchpad with unified top bar", async ({ page }) => {
	await page.goto("/");
	const header = page.locator("header");
	await expect(header.locator("img")).toBeVisible();
	await expect(header.getByTitle("Note options")).toBeVisible();
	await expect(header.getByTitle("New note")).toBeVisible();
	await expect(header.getByTitle("Board")).toBeVisible();
	await expect(header.getByTitle("All notes")).toBeVisible();
	await expect(header.getByText("Untitled")).toBeVisible();
});

test("creates a note, types markdown, and persists via save_note", async ({ page }) => {
	await page.goto("/");
	await newNoteButton(page).click();
	await page.waitForTimeout(300);

	const editor = page.locator(".tiptap");
	await editor.click();
	await editor.pressSequentially("# My Heading\n\nSome **bold** text here");

	await page.waitForTimeout(1200);
	const stored = await page.evaluate(() => {
		const store = (window as unknown as { __store?: { notes: unknown[] } }).__store!;
		return store.notes as Array<{ title: string; content: string }>;
	});
	expect(stored.length).toBe(1);
	expect(stored[0].content).toContain("# My Heading");
	expect(stored[0].content).toContain("**bold**");
});

test("sidebar lists and selects notes", async ({ page }) => {
	await page.goto("/");
	await newNoteButton(page).click();
	await page.waitForTimeout(300);
	const editor = page.locator(".tiptap");
	await editor.click();
	await editor.pressSequentially("First note content");

	await page.getByTitle("All notes").click();
	const sidebar = page.locator("aside");
	const row = sidebar.locator("button", { hasText: "First note content" });
	await expect(row).toBeVisible();
	await row.click();
	await page.waitForTimeout(300);
	await expect(page.locator(".tiptap")).toContainText("First note content");
});

test("inserts the PR checklist with predefined items", async ({ page }) => {
	await page.goto("/");
	await newNoteButton(page).click();
	await page.waitForTimeout(300);

	const editor = page.locator(".tiptap");
	await editor.click();
	await editor.pressSequentially("Checking a PR:");
	await page.getByTitle("PR checklist").click();

	await page.waitForTimeout(400);
	const items = await page.locator(".tiptap ul[data-type='taskList'] li div").allTextContents();
	expect(items).toContain("Tested Autonomously");
	expect(items).toContain("Files Reviewed");
	expect(items).toContain("Manually Tested");
});

test("@ opens PR autocomplete grouped by org and inserts a mention", async ({ page }) => {
	await page.goto("/");
	await newNoteButton(page).click();
	await page.waitForTimeout(300);

	const editor = page.locator(".tiptap");
	await editor.click();
	await editor.pressSequentially("See ");
	await editor.press("@");

	const popup = page.locator("[data-scratch-popup='pr']");
	await expect(popup).toBeVisible();

	await expect(popup.getByText("theexperiencecompany", { exact: true })).toBeVisible();
	await expect(popup.getByText("testuser", { exact: true })).toBeVisible();
	await expect(popup.locator('[class*="var(--success)"]')).toBeVisible();
	await expect(popup.locator('[class*="var(--danger)"]')).toBeVisible();
	await expect(popup.getByText("Draft", { exact: true })).toBeVisible();

	await popup.locator("button").first().click();

	await page.waitForTimeout(300);
	const mention = page.locator(".tiptap .pr-mention").first();
	await expect(mention).toBeVisible();
	const text = await mention.textContent();
	expect(text).toContain("#");

	await page.waitForFunction(() => {
		const store = (window as unknown as { __store?: { notes: unknown[] } }).__store!;
		return (store.notes as Array<{ content: string }>)[0]?.content.includes("github.com");
	});
	const stored = await page.evaluate(() => {
		const store = (window as unknown as { __store?: { notes: unknown[] } }).__store!;
		return store.notes as Array<{ content: string }>;
	});
	expect(stored[0].content).toContain("/pull/");
});

test("slash command opens the command menu", async ({ page }) => {
	await page.goto("/");
	await newNoteButton(page).click();
	await page.waitForTimeout(300);

	const editor = page.locator(".tiptap");
	await editor.click();
	await editor.press("/");

	const menu = page.locator("[data-scratch-popup='slash']");
	await expect(menu).toBeVisible();
	await expect(menu.getByText("Task list", { exact: true })).toBeVisible();
	await expect(menu.getByText("PR checklist", { exact: true })).toBeVisible();
});

test("formatting toolbar collapses and expands", async ({ page }) => {
	await page.goto("/");
	await newNoteButton(page).click();
	await page.waitForTimeout(300);

	const boldButton = page.getByRole("button", { name: "B", exact: true });
	await expect(boldButton).toBeVisible();
	await page.getByTitle("Hide formatting toolbar", { exact: true }).click();
	await expect(boldButton).toBeHidden();
	await expect(page.getByTitle("Show formatting toolbar", { exact: true })).toBeVisible();
	await page.getByTitle("Show formatting toolbar", { exact: true }).click();
	await expect(boldButton).toBeVisible();
});

test("hides PRs from orgs listed in hiddenOrgs config", async ({ page }) => {
	await page.goto("/");
	await primeConfig(page, { hiddenOrgs: ["testuser"] });
	await newNoteButton(page).click();
	await page.waitForTimeout(300);

	const editor = page.locator(".tiptap");
	await editor.click();
	await editor.pressSequentially("See ");
	await editor.press("@");

	const popup = page.locator("[data-scratch-popup='pr']");
	await expect(popup).toBeVisible();
	await expect(popup.getByText("testuser", { exact: true })).toHaveCount(0);
	await expect(popup.getByText(/pet-project/)).toHaveCount(0);
	await expect(popup.getByText("theexperiencecompany", { exact: true })).toBeVisible();
	await expect(popup.getByText("chore: release master")).toBeVisible();
});
