#!/usr/bin/env node
// Windows-compatible smoke/QA for Stillwood.
// Audits desktop + mobile render, console errors, steering direction,
// and captures screenshots under ./screenshots. Prints a JSON verdict.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:8080/?qa=1";
const outDir = resolve("screenshots");
mkdirSync(outDir, { recursive: true });

function wrap(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

const browser = await chromium.launch({ headless: true });
const verdict = { url, viewports: {}, controls: null, ok: true };

for (const vp of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const errors = [];
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e?.message || e)));
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  // Dev mode compiles the three.js graph lazily — wait for the WebGL canvas.
  let canvasWait = "ok";
  try {
    await page.waitForSelector("canvas", { timeout: 45000 });
  } catch {
    canvasWait = "timeout";
  }
  await page.waitForTimeout(3500);

  const title = await page.title();
  const canvasCount = await page.locator("canvas").count();
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  const hasStartUI =
    bodyText.includes("Stillwood") || bodyText.includes("Begin drive") || bodyText.length > 40;

  await page.screenshot({ path: resolve(outDir, `qa-${vp.name}.png`) });

  // On desktop, take the game for a drive and capture a mid-drive frame.
  let drive = null;
  if (vp.name === "desktop") {
    try {
      const started = await page.evaluate(async () => {
        const probe = window.__controlsTest;
        if (!probe) return { ok: false, reason: "no probe" };
        probe.start?.();
        return { ok: true };
      });
      if (started.ok) {
        await page.evaluate(() => {
          window.__controlsTest.setThrottle?.(1);
          window.__controlsTest.setKeys?.(["KeyW"]);
        });
        await page.waitForTimeout(2200);
        const before = await page.evaluate(() => ({
          yaw: window.__controlsTest.getYaw(),
          speed: window.__controlsTest.getSpeed(),
        }));
        await page.evaluate(() => {
          window.__controlsTest.setSteer?.(1);
          window.__controlsTest.setKeys?.(["KeyW", "KeyA"]);
        });
        await page.waitForTimeout(700);
        const afterA = await page.evaluate(() => window.__controlsTest.getYaw());
        await page.evaluate(() => {
          window.__controlsTest.setSteer?.(0);
          window.__controlsTest.setKeys?.(["KeyW"]);
        });
        await page.waitForTimeout(250);
        const mid = await page.evaluate(() => window.__controlsTest.getYaw());
        await page.evaluate(() => {
          window.__controlsTest.setSteer?.(-1);
          window.__controlsTest.setKeys?.(["KeyW", "KeyD"]);
        });
        await page.waitForTimeout(700);
        const afterD = await page.evaluate(() => window.__controlsTest.getYaw());
        const dA = wrap(afterA - before.yaw);
        const dD = wrap(afterD - mid);
        drive = {
          speed: before.speed,
          dA,
          dD,
          aTurnsLeft: dA > 0.05,
          dTurnsRight: dD < -0.05,
          moving: before.speed > 1,
        };
        await page.screenshot({ path: resolve(outDir, "qa-driving.png") });
      } else {
        drive = { skipped: true, reason: started.reason };
      }
    } catch (e) {
      drive = { error: String(e?.message || e) };
    }
  }

  verdict.viewports[vp.name] = {
    status: resp?.status() ?? 0,
    title,
    canvasWait,
    canvasCount,
    textLength: bodyText.length,
    hasVisibleContent: hasStartUI && bodyText.length > 20,
    horizontalOverflow: overflow,
    consoleErrors: errors,
    ...(drive ? { drive } : {}),
  };
  if (!hasStartUI || errors.length > 0 || canvasWait !== "ok" || (vp.name === "mobile" && overflow))
    verdict.ok = false;
  await page.close();
}

await browser.close();
writeFileSync(resolve(outDir, "qa-verdict.json"), JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
if (!verdict.ok) process.exit(1);
