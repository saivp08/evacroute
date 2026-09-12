import { chromium } from "playwright";
const SC = "/private/tmp/claude-501/-Users-nehashafi-Downloads-evacroute/c59dd532-9ce3-4793-83ab-a38867865e93/scratchpad";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForSelector(".leaflet-container");
await page.waitForTimeout(1000);
// Force-disable backdrop-filter on the tiles to test the hypothesis
await page.evaluate(() => {
  document.querySelectorAll(".metrics-strip-tile").forEach((el) => {
    el.style.backdropFilter = "none";
    el.style.setProperty("-webkit-backdrop-filter", "none");
  });
});
await page.waitForTimeout(300);
await page.locator(".map-metrics-overlay").screenshot({ path: `${SC}/overlay-crop-no-blur.png` });
await browser.close();
