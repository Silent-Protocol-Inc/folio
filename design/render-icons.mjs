// Renders design/app-icon.svg to the PNG icons in public/ (headless Chromium via Playwright).
// Usage: node design/render-icons.mjs <path to playwright's index.mjs>  (CHROMIUM=/path/to/chromium to override)
import { readFile } from "node:fs/promises";
const { chromium } = await import(process.argv[2]);
const svg = await readFile(new URL("./app-icon.svg", import.meta.url), "utf8");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/usr/bin/chromium" });
for (const [file, size] of [["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname, omitBackground: false });
  await page.close();
}
await browser.close();
