import { expect, test } from "@playwright/test";
import { tauriMockInitScript } from "./mockTauri";

const sizes = [
	{ w: 320, h: 360 },
	{ w: 420, h: 520 },
	{ w: 600, h: 700 },
	{ w: 900, h: 800 },
];

for (const { w, h } of sizes) {
	test(`no overflow/overlap at ${w}x${h}`, async ({ page }) => {
		await page.setViewportSize({ width: w, height: h });
		await page.addInitScript(tauriMockInitScript);
		await page.goto("/");
		await page.locator("header button[title='New note']").click();
		await page.waitForTimeout(400);

		const audit = await page.evaluate(() => {
			const issues: string[] = [];
			const root = document.querySelector("#root");
			if (!root) return issues;
			const rootRect = root.getBoundingClientRect();

			// 1. horizontal scroll anywhere
			const hasHScroll =
				document.documentElement.scrollWidth > document.documentElement.clientWidth;
			if (hasHScroll) issues.push("document horizontal overflow");

			// 2. elements sticking out past viewport right/bottom
			for (const el of document.querySelectorAll("header, main, .tiptap, button, div")) {
				const r = el.getBoundingClientRect();
				const style = window.getComputedStyle(el);
				if (style.position === "fixed" || style.display === "none" || style.visibility === "hidden")
					continue;
				if (r.width === 0 && r.height === 0) continue;
				if (r.right > window.innerWidth + 1 && r.left < window.innerWidth) {
					issues.push(
						`element overflows right: ${el.tagName}.${el.className} right=${r.right} innerW=${window.innerWidth}`,
					);
				}
				if (r.bottom > window.innerHeight + 1 && r.top < window.innerHeight) {
					issues.push(
						`element overflows bottom: ${el.tagName}.${el.className} bottom=${r.bottom} innerH=${window.innerHeight}`,
					);
				}
			}
			return issues;
		});

		console.log(`AUDIT ${w}x${h}:`, JSON.stringify(audit, null, 2));
		expect(audit).toEqual([]);
	});
}
