import { createCheckout, handleWebhook, quote } from "./lib.js";
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    try {
      if (u.pathname === "/api/checkout" && req.method === "POST") {
        const r = await createCheckout(env);
        if (r.status !== 200) return json({ error: r.data?.error?.message || "checkout failed" }, r.status === 503 ? 503 : 502);
        return Response.redirect(r.data.url, 303);
      }
      if (u.pathname === "/api/webhook" && req.method === "POST") return handleWebhook(req, env);
      if (u.pathname === "/api/quote" && req.method === "POST") { const r = await quote(env, await req.json()); return json(r.data, r.status); }
      if (u.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);
    } catch (e) { return json({ error: e.message }, 500); }
    return env.ASSETS.fetch(req);
  },
};
