import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForSelector(".leaflet-container");
await page.waitForTimeout(1000);
const info = await page.evaluate(() => {
  const overlay = document.querySelector(".map-metrics-overlay");
  const strip = document.querySelector(".metrics-strip");
  const tile = document.querySelector(".metrics-strip-tile");
  const rectOf = (el) => el ? el.getBoundingClientRect() : null;
  const styleOf = (el) => el ? getComputedStyle(el) : null;
  return {
    overlayExists: !!overlay,
    overlayRect: rectOf(overlay),
    overlayDisplay: styleOf(overlay)?.display,
    overlayZ: styleOf(overlay)?.zIndex,
    stripExists: !!strip,
    stripRect: rectOf(strip),
    stripDisplay: styleOf(strip)?.display,
    tileExists: !!tile,
    tileRect: rectOf(tile),
    tileBg: styleOf(tile)?.background,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
