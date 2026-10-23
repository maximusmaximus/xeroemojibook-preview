import lighthouse from "lighthouse"; import * as cl from "chrome-launcher";
const c = await cl.launch({ chromePath: "/usr/bin/google-chrome", chromeFlags: ["--headless=new", "--no-sandbox"] });
let fail = 0;
for (const ff of ["mobile", "desktop"]) {
  const r = await lighthouse("http://127.0.0.1:8788/", { port: c.port, onlyCategories: ["performance", "accessibility", "best-practices", "seo"], ...(ff === "desktop" ? { formFactor: "desktop", screenEmulation: { disabled: true }, throttlingMethod: "provided" } : {}) }, ff === "desktop" ? (await import("lighthouse/core/config/desktop-config.js")).default : undefined);
  const s = Object.fromEntries(Object.entries(r.lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
  console.log(ff, JSON.stringify(s)); if (!(s.performance >= 90) || !(s.accessibility >= 90)) fail = 1; if (0 || s.accessibility < 90) fail = 1;
}
await c.kill(); process.exit(fail);
