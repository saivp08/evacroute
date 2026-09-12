import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForSelector(".leaflet-container");
await page.waitForTimeout(1200);
const info = await page.evaluate(() => {
  const overlay = document.querySelector(".map-metrics-overlay");
  const mapFrame = document.querySelector(".map-frame");
  const leafletContainer = document.querySelector(".leaflet-container");
  const rect = overlay.getBoundingClientRect();
  const topEl = document.elementFromPoint(rect.x + 10, rect.y + 10);
  return {
    mapFramePosition: getComputedStyle(mapFrame).position,
    mapFrameChildren: Array.from(mapFrame.children).map(c => c.className),
    leafletContainerZ: getComputedStyle(leafletContainer).zIndex,
    leafletContainerPosition: getComputedStyle(leafletContainer).position,
    overlayOpacity: getComputedStyle(overlay).opacity,
    overlayVisibility: getComputedStyle(overlay).visibility,
    overlayZ: getComputedStyle(overlay).zIndex,
    overlayParent: overlay.parentElement.className,
    topElementAtPoint: topEl ? topEl.className : null,
    topElementTag: topEl ? topEl.tagName : null,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
