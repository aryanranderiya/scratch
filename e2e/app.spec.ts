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
	await expect(header.getByTitle("Note options")).toBeVisible();
	await expect(header.getByTitle("New note")).toBeVisible();
	await expect(header.getByTitle("Kanban")).toBeVisible();
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

test("@ opens PR autocomplete grouped by state and inserts a card", async ({ page }) => {
	await page.goto("/");
	await newNoteButton(page).click();
	await page.waitForTimeout(300);

	const editor = page.locator(".tiptap");
	await editor.click();
	await editor.pressSequentially("See ");
	await editor.press("@");

	const popup = page.locator("[data-scratch-popup='pr']");
	await expect(popup).toBeVisible();

	// State sections: passing at top (no header), failing + drafts labeled
	await expect(popup.getByText("chore: release master", { exact: true })).toBeVisible();
	await expect(popup.getByText("Open · Failing", { exact: true })).toBeVisible();
	await expect(popup.getByText("Drafts", { exact: true })).toBeVisible();
	// PR icon: green for open, grey for draft
	await expect(popup.locator('[style*="var(--success)"]').first()).toBeVisible();
	// CI icons: green check, red cross
	await expect(popup.locator('[style*="var(--danger)"]').first()).toBeVisible();
	await expect(popup.getByText("Draft", { exact: true })).toBeVisible();

	await popup.locator("button[title='chore: release master']").click();

	await page.waitForTimeout(300);
	const mention = page.locator(".tiptap .pr-mention-card").first();
	await expect(mention).toBeVisible();
	// Full-width card: icon tile + title row + repo #num row
	await expect(mention.locator("svg").first()).toBeVisible();
	const box = await mention.boundingBox();
	expect(box).not.toBeNull();
	if (box) {
		// card spans nearly the full editor width (no unnecessary truncation)
		expect(box.width).toBeGreaterThan(300);
	}
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

test("pasting an image saves it to the vault and inserts a markdown image", async ({ page }) => {
	await page.goto("/");
	await newNoteButton(page).click();
	await page.waitForTimeout(300);

	const editor = page.locator(".tiptap");
	await editor.click();

	// Simulate pasting an image file from the clipboard
	await page.evaluate(() => {
		const dt = new DataTransfer();
		const file = new File([new Uint8Array([137, 80, 78, 71])], "shot.png", {
			type: "image/png",
		});
		dt.items.add(file);
		const evt = new Event("paste", { bubbles: true, cancelable: true });
		Object.defineProperty(evt, "clipboardData", { value: dt });
		document.querySelector(".tiptap")?.dispatchEvent(evt);
	});

	const img = page.locator(".tiptap img.scratch-image");
	await expect(img).toHaveCount(1);
	// Rendered through the scratch-asset:// URI scheme (vault-relative file)
	await expect(img).toHaveAttribute(
		"src",
		/^scratch-asset:\/\/vault\/scratch-assets\/mock-\d+\.png$/,
	);

	await page.waitForTimeout(1200);
	const stored = await page.evaluate(() => {
		const store = (window as unknown as { __store?: { notes: unknown[] } }).__store!;
		return store.notes as Array<{ content: string }>;
	});
	// The note persists a portable relative path, not the URI scheme
	expect(stored[0].content).toMatch(/!\[shot\.png\]\(scratch-assets\/mock-\d+\.png\)/);
});

test("cmd+a and ctrl+a select the whole note", async ({ page }) => {
	await page.goto("/");
	await newNoteButton(page).click();
	await page.waitForTimeout(300);

	const editor = page.locator(".tiptap");
	await editor.click();
	await editor.pressSequentially("line one\n\nline two");
	await page.waitForTimeout(300);

	for (const key of ["Meta+a", "Control+a"]) {
		await page.keyboard.press(key);
		await page.waitForTimeout(150);
		const sel = await page.evaluate(() => window.getSelection()?.toString() ?? "");
		expect(sel).toContain("line one");
		expect(sel).toContain("line two");
		await editor.click();
		await page.waitForTimeout(150);
	}
});

test("refresh shows a spinner inside the button without swapping the list to skeletons", async ({ page }) => {
	await page.goto("/");
	await newNoteButton(page).click();
	await page.waitForTimeout(300);

	const editor = page.locator(".tiptap");
	await editor.click();
	await editor.pressSequentially("See ");
	await editor.press("@");

	const popup = page.locator("[data-scratch-popup='pr']");
	await expect(popup).toBeVisible();

	// Slow down the forced refetch so the spinner is observable.
	await page.evaluate(() => {
		const s = (window as unknown as { __store?: { prSearchDelayMs?: number } }).__store;
		if (s) s.prSearchDelayMs = 800;
	});

	// The refresh button is the last button in the popup (bottom of the list).
	const refreshBtn = popup.locator("button").last();
	await expect(refreshBtn).toHaveAttribute("title", "Refresh pull requests");
	await refreshBtn.click();

	// The list stays (PR cards still visible — no skeleton swap)…
	await expect(popup.getByText("chore: release master", { exact: true })).toBeVisible();
	// …and the refresh icon inside the button spins until the fetch resolves.
	await expect(refreshBtn.locator("svg.animate-spin")).toBeVisible();

	// After the delay the spinner is gone and the button is re-enabled.
	await expect(refreshBtn.locator("svg.animate-spin")).toHaveCount(0);
	await expect(refreshBtn).toBeEnabled();
	await expect(refreshBtn).toHaveAttribute("title", "Refresh pull requests");
});

test("deleting the last note shows the empty state, not a blank screen", async ({ page }) => {
	await page.goto("/");
	await newNoteButton(page).click();
	await page.waitForTimeout(300);
	await page.locator(".tiptap").click();
	await page.locator(".tiptap").pressSequentially("only note");

	await page.locator("header button[title='Note options']").click();
	await page.waitForTimeout(200);
	await page.getByText("Delete note", { exact: true }).click();
	await page.waitForTimeout(600);

	// The app must still render the top bar + empty state (no blank screen).
	await expect(page.locator("header")).toBeVisible();
	await expect(page.getByText("No note selected", { exact: true })).toBeVisible();
	await expect(page.getByText("New note", { exact: true })).toBeVisible();

	// And a new note can be created right after.
	await newNoteButton(page).click();
	await page.waitForTimeout(400);
	await expect(page.locator(".tiptap")).toBeVisible();
});

test("@ picker excludes PRs from repos in hiddenRepos", async ({ page }) => {
	await page.goto("/");
	await primeConfig(page, { hiddenRepos: ["theexperiencecompany/gaia"] });
	await newNoteButton(page).click();
	await page.waitForTimeout(300);

	const editor = page.locator(".tiptap");
	await editor.click();
	await editor.pressSequentially("See ");
	await editor.press("@");

	const popup = page.locator("[data-scratch-popup='pr']");
	await expect(popup).toBeVisible();
	// The hidden repo's PRs are gone entirely…
	await expect(popup.getByText(/gaia#897/)).toHaveCount(0);
	await expect(popup.getByText("chore: release master", { exact: true })).toHaveCount(0);
	// …while the same org's other repos still show.
	await expect(popup.getByText(/pet-project#12/)).toBeVisible();
});

test("merged and closed PRs show purple/red icons and state chips", async ({ page }) => {
	await page.goto("/");
	await page.locator("header button[title='New note']").click();
	await page.waitForTimeout(300);
	const editor = page.locator(".tiptap");
	await editor.click();
	await editor.pressSequentially("See ");
	await editor.press("@");

	const popup = page.locator("[data-scratch-popup='pr']");
	await expect(popup).toBeVisible();
	// Merged + Closed sections exist at the bottom
	await expect(popup.getByText("Merged", { exact: true })).toBeVisible();
	await expect(popup.getByText("Closed", { exact: true })).toBeVisible();
	// Merged PR icon is purple, closed is red (first svg = the PR icon)
	await expect(
		popup
			.locator("button[title='feat(agents): env-configurable custom dev LLM provider'] svg")
			.first(),
	).toHaveCSS("color", "rgb(130, 80, 223)");
	await expect(
		popup.locator("button[title='chore: revert broken config'] svg").first(),
	).toHaveCSS("color", "rgb(255, 59, 48)");

	// Insert the merged PR card — icon purple + Merged chip
	await popup.locator("button[title='feat(agents): env-configurable custom dev LLM provider']").click();
	await page.waitForTimeout(300);
	const card = page.locator(".tiptap .pr-mention-card").first();
	await expect(card).toBeVisible();
	await expect(card.locator("svg").first()).toHaveCSS("color", "rgb(130, 80, 223)");
	await expect(card.getByText("Merged", { exact: true })).toBeVisible();
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
	// Hidden org's PRs excluded entirely
	await expect(popup.getByText(/pet-project/)).toHaveCount(0);
	await expect(popup.getByText(/gaia#897/)).toBeVisible();
	await expect(popup.getByText("chore: release master")).toBeVisible();
});

test("@ picker marks already-linked PRs with a Linked chip", async ({ page }) => {
	await page.goto("/");
	await page.locator("header button[title='New note']").click();
	await page.waitForTimeout(300);
	const editor = page.locator(".tiptap");
	await editor.click();
	// Link gaia#897 first (serializes to the mention markdown)
	await editor.pressSequentially("See ");
	await editor.press("@");
	const popup = page.locator("[data-scratch-popup='pr']");
	await popup.waitFor({ state: "visible" });
	await popup.locator("button[title='chore: release master']").click();
	await page.waitForTimeout(1000); // autosave

	// Open the picker again — the already-linked PR shows a Linked chip
	await editor.pressSequentially(" and ");
	await editor.press("@");
	await popup.waitFor({ state: "visible" });
	await expect(popup.getByText("Linked", { exact: true })).toBeVisible();
	// The linked PR's icon is accent-blue
	const linkedRow = popup.locator("button[title='chore: release master']");
	await expect(linkedRow.locator('[style*="var(--accent)"]').first()).toBeVisible();
	// Non-linked PRs have no Linked chip
	await expect(
		popup.locator("button[title^='fix(web)']").getByText("Linked", { exact: true }),
	).toHaveCount(0);
});
