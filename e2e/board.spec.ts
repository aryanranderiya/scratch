import { expect, test } from "@playwright/test";
import { tauriMockInitScript } from "./mockTauri";

test.use({ viewport: { width: 1280, height: 800 } });

test.beforeEach(async ({ page }) => {
	await page.addInitScript(tauriMockInitScript);
});

test("board view shows columns and PR cards, toggles back to notes", async ({ page }) => {
	await page.goto("/");
	await page.getByTitle("Board").click();

	for (const name of ["New", "In Progress", "Needs Review", "Manually Tested", "Done"]) {
		await expect(page.getByText(name, { exact: true })).toBeVisible();
	}

	await expect(page.getByText("#897")).toBeVisible();
	await expect(page.getByText("#894")).toBeVisible();

	await page.getByTitle("Notes", { exact: true }).click();
	await expect(page.getByText("Untitled")).toBeVisible();
	await expect(page.getByTitle("Board")).toBeVisible();
});

test("adds a column via the inline input", async ({ page }) => {
	await page.goto("/");
	await page.getByTitle("Board").click();

	await page.getByText("Add column").click();
	const input = page.getByPlaceholder("New Column");
	await input.fill("Custom Column");
	await input.press("Enter");

	await expect(page.getByText("Custom Column", { exact: true })).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(() => {
				const store = (
					window as unknown as { __store?: { board?: { columns?: Array<{ name: string }> } } }
				).__store;
				return store?.board?.columns?.map((c) => c.name) ?? [];
			}),
		)
		.toContain("Custom Column");
});

test("drags a PR card between columns and persists the board", async ({ page }) => {
	await page.goto("/");
	await page.getByTitle("Board").click();

	const card = page.locator(".cursor-grab", { hasText: "theexperiencecompany/gaia#897" });
	await expect(card).toBeVisible();

	const targetColumn = page.getByText("In Progress", { exact: true }).locator("xpath=../..");

	// @dnd-kit's closestCorners sums corner-to-corner distances, so dropping near
	// the column center loses to the dragged card itself (its rect follows the
	// pointer). Dropping near the column's bottom-right corner gives the column
	// the smallest corner distance, which is the reliable target. Stepped pointer
	// moves give the PointerSensor time to activate and React time to settle
	// before the drop.
	const from = (await card.boundingBox())!;
	const to = (await targetColumn.boundingBox())!;
	const endX = to.x + to.width - 25;
	const endY = to.y + to.height - 40;
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.waitForTimeout(100);
	for (let i = 1; i <= 10; i++) {
		await page.mouse.move(
			from.x + from.width / 2 + ((endX - from.x - from.width / 2) * i) / 10,
			from.y + from.height / 2 + ((endY - from.y - from.height / 2) * i) / 10,
		);
		await page.waitForTimeout(40);
	}
	await page.waitForTimeout(250);
	await page.mouse.up();

	await expect
		.poll(
			() =>
				page.evaluate(() => {
					const store = (
						window as unknown as { __store?: { board?: { cards?: Record<string, string> } } }
					).__store;
					return store?.board?.cards?.["theexperiencecompany/gaia#897"] ?? null;
				}),
			{ timeout: 5000 },
		)
		.toBe("in-progress");

	await expect(targetColumn.getByText("#897")).toBeVisible();
});

test("filters PRs by repo from the top bar and supports select all / none", async ({ page }) => {
	await page.goto("/");
	await page.getByTitle("Board").click();

	await expect(page.getByText("#897")).toBeVisible();
	await expect(page.getByText("#12")).toBeVisible();

	// Hide one repo via the filter menu in the top bar
	await page.getByTitle("Filter repos").click();
	await page
		.locator("[class*='surface-raised']")
		.getByRole("button", { name: "testuser/pet-project", exact: true })
		.click();
	await page.mouse.click(5, 5); // close the popover

	await expect(page.getByText("#897")).toBeVisible();
	await expect(page.getByText("#12")).not.toBeVisible();

	// Select none hides everything
	await page.getByTitle("Filter repos").click();
	await page.getByText("Select none").click();
	await page.mouse.click(5, 5);
	await expect(page.getByText("No pull requests match the current filter")).toBeVisible();

	// Select all restores everything
	await page.getByTitle("Filter repos").click();
	await page.getByText("Select all").click();
	await page.mouse.click(5, 5);
	await expect(page.getByText("#897")).toBeVisible();
	await expect(page.getByText("#12")).toBeVisible();
});
