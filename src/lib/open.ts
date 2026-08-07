import { openUrl as openerOpenUrl } from "@tauri-apps/plugin-opener";

export async function openUrl(url: string): Promise<void> {
	await openerOpenUrl(url);
}
