import { chromium } from "playwright";

const SC = "/private/tmp/claude-501/-Users-nehashafi-Downloads-evacroute/c59dd532-9ce3-4793-83ab-a38867865e93/scratchpad";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));
page.on("requestfailed", (req) => errors.push(`REQUEST_FAILED: ${req.url()}`));

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForSelector(".leaflet-container");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${SC}/redesign-1-overview.png` });

// Select a vehicle to check highlight/route glow/popup
await page.click(".leaflet-control-zoom-in");
await page.waitForTimeout(400);
const fleetRow = page.locator(".ov-row-button", { hasText: "Medic 12" });
await fleetRow.click();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${SC}/redesign-2-vehicle-selected.png` });

// Click an infrastructure marker
await page.click(".leaflet-popup-close-button").catch(() => {});
await page.waitForTimeout(200);
const hospitalMarker = page.locator(".marker-badge", { hasText: /^H$/ }).first();
await hospitalMarker.click({ force: true });
await page.waitForTimeout(500);
await page.screenshot({ path: `${SC}/redesign-3-infrastructure-popup.png` });

// Sidebar placeholder page
await page.click(".leaflet-popup-close-button").catch(() => {});
await page.click('button:has-text("Incidents")');
await page.waitForTimeout(400);
await page.screenshot({ path: `${SC}/redesign-4-placeholder.png` });

console.log("CONSOLE_ERRORS:", JSON.stringify(errors));
await browser.close();
