import test from "node:test"; import assert from "node:assert";
import { verifyStripeSig, buildRpiOrder, handleWebhook, quote, SKU } from "../src/lib.js";
import crypto from "node:crypto";
const SECRET = "whsec_test_local";
const sign = (body, t = Math.floor(Date.now()/1000)) => `t=${t},v1=` + crypto.createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex");
const session = { id: "cs_test_123", payment_status: "paid", customer_details: { email: "buyer@example.com" },
  shipping_details: { name: "Test Buyer", address: { line1: "1 Main St", city: "Chico", state: "CA", postal_code: "95926", country: "US" } },
  shipping_cost: { shipping_rate_metadata: { rpi: "expedited" } } };
const ev = JSON.stringify({ type: "checkout.session.completed", data: { object: session } });
const req = (b, s) => new Request("http://x/api/webhook", { method: "POST", body: b, headers: { "stripe-signature": s } });

test("signature valid/invalid/stale", async () => {
  assert.ok(await verifyStripeSig(ev, sign(ev), SECRET));
  assert.ok(!(await verifyStripeSig(ev, sign(ev).replace(/v1=./, "v1=0"), SECRET)));
  assert.ok(!(await verifyStripeSig(ev, sign(ev, 1000), SECRET)));
});
test("RPI order mapping", () => {
  const o = buildRpiOrder(session);
  assert.equal(o.orderItems[0].sku, SKU); assert.equal(o.shippingClassification, "expedited");
  assert.equal(o.destination.regionCode, "CA"); assert.equal(o.orderItems[0].product.pageCount, 530);
});
test("webhook: flag OFF => dry run, no RPI call", async () => {
  const orig = globalThis.fetch; let called = false; globalThis.fetch = async () => { called = true; throw new Error("no"); };
  const r = await handleWebhook(req(ev, sign(ev)), { STRIPE_WEBHOOK_SECRET: SECRET, RPI_LIVE_ORDERS: "false" });
  globalThis.fetch = orig; const d = await r.json();
  assert.equal(d.dryRun, true); assert.equal(called, false);
});
test("webhook: bad sig 400", async () => {
  const r = await handleWebhook(req(ev, "t=1,v1=00"), { STRIPE_WEBHOOK_SECRET: SECRET });
  assert.equal(r.status, 400);
});
test("RPI read-only shipping estimate (live API)", { skip: !process.env.RPI_API_AUTH }, async () => {
  const r = await quote({ RPI_BASE_URL: "https://open.api.rpiprint.com", RPI_API_AUTH: process.env.RPI_API_AUTH },
    { name: "Q", address1: "1 Main St", city: "Chico", regionCode: "CA", postal: "95926", country: "US" });
  assert.equal(r.status, 200); assert.ok(r.data.some(m => m.methodClassification === "standard" && m.price > 0));
  console.log("RPI rates:", r.data.map(m => `${m.methodClassification} $${m.price}`).join(", "));
});
import { createCheckout } from "../src/lib.js";
test("checkout disabled (coming soon) even with flag on", async () => {
  const r = await createCheckout({ CHECKOUT_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_x" }); assert.equal(r.status, 503);
});
