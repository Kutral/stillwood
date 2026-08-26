import { chromium } from "playwright";

const url = process.env.QA_URL || "http://127.0.0.1:8080/?qa=1";

function wrap(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (err) => console.error("PAGEERROR", err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.error("CONSOLE", msg.text());
});

await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2500);

const started = await page.evaluate(async () => {
  const probe = window.__controlsTest;
  if (!probe) return { ok: false, reason: "no probe" };
  probe.start?.();
  return { ok: true };
});
if (!started.ok) {
  console.error(JSON.stringify(started));
  process.exit(1);
}

await page.waitForTimeout(400);

await page.evaluate(() => {
  window.__controlsTest.setThrottle?.(1);
  window.__controlsTest.setKeys?.(["KeyW"]);
});

await page.waitForTimeout(900);

const before = await page.evaluate(() => ({
  yaw: window.__controlsTest.getYaw(),
  speed: window.__controlsTest.getSpeed(),
}));

if (before.speed < 1) {
  console.error("speed too low", before);
  process.exit(1);
}

await page.evaluate(() => {
  window.__controlsTest.setSteer?.(1);
  window.__controlsTest.setKeys?.(["KeyW", "KeyA"]);
});
await page.waitForTimeout(600);
const afterA = await page.evaluate(() => ({
  yaw: window.__controlsTest.getYaw(),
  speed: window.__controlsTest.getSpeed(),
}));

await page.evaluate(() => {
  window.__controlsTest.setSteer?.(0);
  window.__controlsTest.setKeys?.(["KeyW"]);
});
await page.waitForTimeout(200);
const mid = await page.evaluate(() => ({
  yaw: window.__controlsTest.getYaw(),
  speed: window.__controlsTest.getSpeed(),
}));

await page.evaluate(() => {
  window.__controlsTest.setSteer?.(-1);
  window.__controlsTest.setKeys?.(["KeyW", "KeyD"]);
});
await page.waitForTimeout(600);
const afterD = await page.evaluate(() => ({
  yaw: window.__controlsTest.getYaw(),
  speed: window.__controlsTest.getSpeed(),
}));

const dA = wrap(afterA.yaw - before.yaw);
const dD = wrap(afterD.yaw - mid.yaw);

const result = {
  before,
  afterA,
  mid,
  afterD,
  dA,
  dD,
  aTurnsLeft: dA > 0.05,
  dTurnsRight: dD < -0.05,
};

console.log(JSON.stringify(result, null, 2));

await page.screenshot({ path: "/workspace/screenshots/stillwood-driving.png" });

await browser.close();

if (!result.aTurnsLeft || !result.dTurnsRight) {
  console.error("CONTROLS FAIL");
  process.exit(1);
}
console.log("CONTROLS PASS");
