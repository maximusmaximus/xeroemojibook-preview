import { test, expect } from "@playwright/test";
test("loads: title, cover, 6 first pages + 5 interior pages", async ({ page }) => {
  const errs = []; page.on("pageerror", e => errs.push(e));
  expect((await page.goto("/")).status()).toBe(200);
  await expect(page.locator("h1")).toHaveText("Xero Emoji");
  await expect(page.locator(".gallery").nth(0).locator("img")).toHaveCount(6);
  await expect(page.locator(".gallery").nth(1).locator("img")).toHaveCount(5); expect(errs).toEqual([]);
});
test("no broken images or links (incl. lightbox sizes)", async ({ page, request }) => {
  await page.goto("/"); await page.evaluate(() => window.scrollTo(0, 1e5));
  await page.waitForFunction(() => [...document.images].filter(i => i.src).every(i => i.complete));
  expect(await page.evaluate(() => [...document.images].filter(i => i.src && !i.naturalWidth).map(i => i.src))).toEqual([]);
  for (const h of await page.$$eval("[data-full]", b => b.map(x => x.dataset.full))) expect((await request.get(h)).status(), h).toBe(200);
  for (const h of await page.$$eval("a[href]", as => as.map(a => a.href))) expect((await request.get(h)).status(), h).toBe(200);
});
test("lightbox opens and closes", async ({ page }) => {
  await page.goto("/"); await page.locator(".gallery button").first().click();
  await expect(page.locator("#lb")).toBeVisible(); await expect(page.locator("#lb img")).toHaveAttribute("src", /p001-1600/);
  await page.keyboard.press("Escape"); await expect(page.locator("#lb")).toBeHidden();
});
test("mobile layout: no horizontal overflow", async ({ browser }) => {
  const p = await (await browser.newContext({ viewport: { width: 360, height: 640 } })).newPage();
  await p.goto("/"); expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
test("preview only: no buy/checkout UI or API", async ({ page, request }) => {
  await page.goto("/"); await expect(page.locator("body")).not.toContainText(/buy|checkout|\$\d|price|order/i);
  for (const p of ["/api/checkout", "/api/webhook"]) expect((await request.post(p)).status()).not.toBe(200);
});
test("screenshots", async ({ browser }) => {
  for (const [n, vp] of [["desktop", { width: 1366, height: 900 }], ["mobile", { width: 375, height: 667 }]]) {
    const p = await (await browser.newContext({ viewport: vp })).newPage(); await p.goto("/");
    await p.screenshot({ path: `screens/${n}-hero.png` }); await p.evaluate(() => window.scrollTo(0, 1e5)); await p.waitForTimeout(500);
    await p.screenshot({ path: `screens/${n}-full.png`, fullPage: true });
    if (n == "desktop") { await p.locator(".gallery").nth(1).locator("button").first().click(); await p.waitForTimeout(800); await p.screenshot({ path: "screens/desktop-lightbox.png" }); }
  }
});
