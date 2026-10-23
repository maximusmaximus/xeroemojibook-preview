export const SKU = "BKPH_HCIW_STD_11.750x11.750IN_80C_MT_40_100T_GLS_44";
// Xero Emoji book (internal name "Xero Worlds"), 530 pp. RPI SKU from xeroemoji-book/DECISIONS.md (cover template approved 2026-10-21).
// TODO: neither print file is hosted at a public URL yet. The RPI cover file exists only on the box
// (xeroemoji-book/cover/rpi-final/Xero-Worlds-RPI-COVER-530pp-v6.1-300ppi.pdf), and there is no RPI-ready interior file.
export const PRODUCT = { coverUrl: null, gutsUrl: null, pageCount: 530 };
export const PRICE_CENTS = null; // TODO: no retail price set by Max yet (RPI production cost is about $102.60/copy)
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

async function rpi(env, method, path, body) {
  const r = await fetch(env.RPI_BASE_URL + path, { method, headers: { Authorization: env.RPI_API_AUTH, "Content-Type": "application/json", Accept: "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => null) };
}
// Read-only: shipping estimate for an address
export async function quote(env, destination) {
  return rpi(env, "POST", "/orders/shipping/estimate", { currency: "USD", destination, orderItems: [{ sku: SKU, quantity: 1 }] });
}

async function stripe(env, path, params) {
  if (!env.STRIPE_SECRET_KEY?.startsWith("sk_test_") && env.ALLOW_LIVE_STRIPE !== "true") throw new Error("STRIPE_SECRET_KEY must be a sk_test_ key");
  const r = await fetch("https://api.stripe.com/v1" + path, { method: "POST", headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
  return { status: r.status, data: await r.json() };
}

export const checkoutReady = env => env.CHECKOUT_ENABLED === "true" && PRICE_CENTS && PRODUCT.coverUrl && PRODUCT.gutsUrl;
export async function createCheckout(env) {
  if (!checkoutReady(env)) return { status: 503, data: { error: { message: "Checkout coming soon" } } };
  // Shipping rates from RPI (reference US address; actual at-cost charge reconciled post-purchase)
  const q = await quote(env, { name: "Quote", address1: "1 Main St", city: "Chico", regionCode: "CA", postal: "95926", country: "US" });
  const p = { mode: "payment", "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "usd", "line_items[0][price_data][unit_amount]": String(PRICE_CENTS), "line_items[0][price_data][product_data][name]": "Xero Emoji: V1.0.0 Specimen Guide (hardcover, 530 pp)", "shipping_address_collection[allowed_countries][0]": "US", "shipping_address_collection[allowed_countries][1]": "CA", success_url: env.PUBLIC_BASE_URL + "/thanks.html?session_id={CHECKOUT_SESSION_ID}", cancel_url: env.PUBLIC_BASE_URL + "/#buy", "metadata[sku]": SKU };
  (Array.isArray(q.data) ? q.data : []).forEach((m, i) => {
    const k = `shipping_options[${i}][shipping_rate_data]`;
    p[k + "[type]"] = "fixed_amount"; p[k + "[display_name]"] = m.methodClassification; p[k + "[fixed_amount][amount]"] = String(Math.round(m.price * 100)); p[k + "[fixed_amount][currency]"] = "usd"; p[k + "[metadata][rpi]"] = m.methodClassification;
  });
  return stripe(env, "/checkout/sessions", p);
}

const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
export async function verifyStripeSig(payload, header, secret, tol = 300) {
  const parts = Object.fromEntries((header || "").split(",").map(s => s.split("=")).filter(a => a.length === 2 && a[0] !== "v1"));
  const sigs = (header || "").split(",").filter(s => s.startsWith("v1=")).map(s => s.slice(3));
  const t = parts.t; if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > tol) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`)));
  return sigs.includes(mac);
}

export function buildRpiOrder(session) {
  const s = session.shipping_details || session.collected_information?.shipping_details || {};
  const a = s.address || {};
  return { customerOrderId: "xeb-" + session.id, currency: "USD", shippingClassification: session.shipping_cost?.shipping_rate_metadata?.rpi || "standard",
    destination: { name: s.name, address1: a.line1, address2: a.line2 || undefined, city: a.city, regionCode: a.state, postal: a.postal_code, country: a.country, email: session.customer_details?.email },
    orderItems: [{ sku: SKU, quantity: 1, itemDescription: "Xero Emoji: V1.0.0 Specimen Guide (530pp)", product: PRODUCT }] };
}

export async function handleWebhook(req, env) {
  const body = await req.text();
  if (!(await verifyStripeSig(body, req.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET))) return json({ error: "bad signature" }, 400);
  const ev = JSON.parse(body);
  if (ev.type !== "checkout.session.completed" || ev.data.object.payment_status !== "paid") return json({ ignored: ev.type });
  const order = buildRpiOrder(ev.data.object);
  if (env.RPI_LIVE_ORDERS !== "true" || !PRODUCT.gutsUrl) return json({ dryRun: true, order });
  const r = await rpi(env, "POST", "/orders/", order);
  return json({ created: r.status, rpi: r.data }, r.status < 300 ? 200 : 502);
}

