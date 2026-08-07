import { expect, test } from "@playwright/test";
import { tauriMockInitScript } from "./mockTauri";

for (const { w, h } of [
	{ w: 320, h: 360 },
	{ w: 420, h: 520 },
	{ w: 600, h: 700 },
]) {
	test(`sidebar + settings fit at ${w}x${h}`, async ({ page }) => {
		await page.setViewportSize({ width: w, height: h });
		await page.addInitScript(tauriMockInitScript);
		await page.goto("/");

		// create several notes so lists scroll
		for (let i = 0; i < 6; i++) {
			await page.locator("header button[title='New note']").click();
			await page.waitForTimeout(120);
			const editor = page.locator(".tiptap");
			await editor.click();
			await editor.pressSequentially(`Note number ${i} with some longer content to scroll`);
			await page.waitForTimeout(80);
		}

		// open sidebar and verify it fits + scrolls
		await page.getByTitle("All notes").click();
		await page.waitForTimeout(300);
		const sidebarAudit = await page.evaluate(() => {
			const issues: string[] = [];
			const aside = document.querySelector("aside");
			if (!aside) {
				issues.push("sidebar not found");
				return issues;
			}
			const r = aside.getBoundingClientRect();
			if (r.right > window.innerWidth + 1) issues.push("sidebar overflows right");
			if (r.bottom > window.innerHeight + 1) issues.push("sidebar overflows bottom");
			if (r.left < -1) issues.push("sidebar overflows left");
			const list = aside.querySelector("[class*='overflow-y-auto']");
			if (list) {
				const scrollable = list.scrollHeight > list.clientHeight + 1;
				if (!scrollable) {
					const lastRow = list.lastElementChild;
					if (lastRow) {
						const lr = lastRow.getBoundingClientRect();
						const lc = list.getBoundingClientRect();
						if (lr.bottom > lc.bottom + 1) {
							issues.push("sidebar list clips content without scrollbar");
						}
					}
				}
			}
			return issues;
		});
		console.log(`SIDEBAR ${w}x${h}:`, JSON.stringify(sidebarAudit));

		// close sidebar via Escape, open settings
		await page.keyboard.press("Escape");
		await page.waitForTimeout(200);
		await page.getByTitle("Note options").click();
		await page.getByText("Settings").click();
		await page.waitForTimeout(300);
		const settingsAudit = await page.evaluate(() => {
			const issues: string[] = [];
			const dialogs = [...document.querySelectorAll("div[class*='max-w-lg']")];
			if (dialogs.length === 0) {
				issues.push("settings modal not found");
				return issues;
			}
			for (const d of dialogs) {
				const r = d.getBoundingClientRect();
				if (r.right > window.innerWidth + 1) issues.push("settings overflows right");
				if (r.bottom > window.innerHeight + 1) issues.push("settings overflows bottom");
				if (r.width > window.innerWidth) {
					issues.push(`settings width ${r.width} > viewport ${window.innerWidth}`);
				}
				const body = d.querySelector("[class*='overflow-y-auto']");
				if (body && body.scrollHeight > body.clientHeight + 1) {
					const overflowY = getComputedStyle(body).overflowY;
					if (overflowY !== "auto" && overflowY !== "scroll") {
						issues.push("settings body overflows but is not scrollable");
					}
				}
			}
			return issues;
		});
		console.log(`SETTINGS ${w}x${h}:`, JSON.stringify(settingsAudit));

		expect(sidebarAudit).toEqual([]);
		expect(settingsAudit).toEqual([]);
	});
}
