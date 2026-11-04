var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/push.js
var te = new TextEncoder();
var b64u = {
  enc(buf) {
    const b = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
    let s = "";
    for (const x of b) s += String.fromCharCode(x);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  dec(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
};
function concat(...parts) {
  const n = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
__name(concat, "concat");
async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, len * 8));
}
__name(hkdf, "hkdf");
async function encrypt(plaintext, p256dh, auth, local = {}) {
  const uaPub = b64u.dec(p256dh);
  const authSecret = b64u.dec(auth);
  const salt = local.salt || crypto.getRandomValues(new Uint8Array(16));
  const kp = local.keyPair || await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, kp.privateKey, 256));
  const keyInfo = concat(te.encode("WebPush: info\0"), uaPub, asPub);
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32);
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const record = concat(plaintext, new Uint8Array([2]));
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, record));
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  const header = concat(salt, rs, new Uint8Array([asPub.length]), asPub);
  return concat(header, ct);
}
__name(encrypt, "encrypt");
async function vapidAuth(endpoint, vapid, subject, nowSec = Math.floor(Date.now() / 1e3)) {
  const aud = new URL(endpoint).origin;
  const header = b64u.enc(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u.enc(te.encode(JSON.stringify({ aud, exp: nowSec + 12 * 3600, sub: subject })));
  const input = `${header}.${claims}`;
  const key = await crypto.subtle.importKey("jwk", vapid.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(input)));
  return `vapid t=${input}.${b64u.enc(sig)}, k=${vapid.publicKey}`;
}
__name(vapidAuth, "vapidAuth");
async function sendPush(subscription, payloadObj, vapid, subject, { ttl = 3600, urgency = "normal", fetchImpl = fetch } = {}) {
  const body = await encrypt(te.encode(JSON.stringify(payloadObj)), subscription.keys.p256dh, subscription.keys.auth);
  const res = await fetchImpl(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "Content-Length": String(body.length),
      TTL: String(ttl),
      Urgency: urgency,
      Authorization: await vapidAuth(subscription.endpoint, vapid, subject)
    },
    body
  });
  return { ok: res.ok, status: res.status };
}
__name(sendPush, "sendPush");

// src/index.js
var VERSION = "0.6.0";
var PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
var CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var te2 = new TextEncoder();
var json = /* @__PURE__ */ __name((obj, status = 200, headers = {}) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } }), "json");
var html = /* @__PURE__ */ __name((s, status = 200) => new Response(s, { status, headers: { "Content-Type": "text/html; charset=utf-8" } }), "html");
var rand = /* @__PURE__ */ __name((n = 32) => b64u.enc(crypto.getRandomValues(new Uint8Array(n))), "rand");
async function sha256b64u(s) {
  return b64u.enc(await crypto.subtle.digest("SHA-256", te2.encode(s)));
}
__name(sha256b64u, "sha256b64u");
function makeCode() {
  const r = crypto.getRandomValues(new Uint8Array(6));
  let s = "";
  for (const x of r) s += CODE_ALPHABET[x % CODE_ALPHABET.length];
  return s;
}
__name(makeCode, "makeCode");
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
__name(esc, "esc");
async function readBody(req) {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await req.json();
  const text = await req.text();
  return Object.fromEntries(new URLSearchParams(text));
}
__name(readBody, "readBody");
function localParts(ts, tz) {
  try {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const p = Object.fromEntries(f.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, minute: Number(p.minute) };
  } catch {
    return localParts(ts, "UTC");
  }
}
__name(localParts, "localParts");
function inQuiet(hour, quiet) {
  if (!quiet || quiet.length !== 2 || quiet[0] === quiet[1]) return false;
  const [a, b] = quiet;
  return a > b ? hour >= a || hour < b : hour >= a && hour < b;
}
__name(inQuiet, "inQuiet");
function cfg(env) {
  return {
    waitMin: Number(env.WAIT_MIN || 60),
    dailyCap: Number(env.DAILY_CAP || 3),
    vapid: { privateJwk: JSON.parse(env.VAPID_PRIVATE_JWK || "{}"), publicKey: env.VAPID_PUBLIC || "" },
    subject: env.VAPID_SUBJECT || "mailto:ping@example.com",
    devKeys: (env.DEV_LICENSE_KEYS || "").split(",").map((s) => s.trim()).filter(Boolean),
    gumroadProduct: env.GUMROAD_PRODUCT_ID || ""
  };
}
__name(cfg, "cfg");
function subsOf(u) {
  const out = { ...u.subs || {} };
  if (u.sub && !Object.values(out).some((x) => x.endpoint === u.sub.endpoint)) out.legacy = u.sub;
  return out;
}
__name(subsOf, "subsOf");
var anySub = /* @__PURE__ */ __name((u) => Object.keys(subsOf(u)).length > 0, "anySub");
var db = {
  async getUser(env, uid) {
    return uid ? await env.PING_KV.get(`u:${uid}`, "json") : null;
  },
  async putUser(env, u) {
    await env.PING_KV.put(`u:${u.uid}`, JSON.stringify(u));
  },
  async uidByCode(env, code) {
    return await env.PING_KV.get(`code:${code}`);
  },
  async uidByDevice(env, t) {
    return t ? await env.PING_KV.get(`dev:${t}`) : null;
  },
  async uidByLicense(env, h) {
    return await env.PING_KV.get(`lic:${h}`);
  },
  async listUids(env) {
    const out = [];
    let cursor;
    do {
      const r = await env.PING_KV.list({ prefix: "u:", cursor });
      for (const k of r.keys) out.push(k.name.slice(2));
      cursor = r.list_complete ? void 0 : r.cursor;
    } while (cursor);
    return out;
  }
};
async function newUser(env, licenseHash) {
  let code;
  for (let i = 0; i < 10; i++) {
    code = makeCode();
    if (!await db.uidByCode(env, code)) break;
  }
  const u = {
    uid: rand(12),
    code,
    created: Date.now(),
    deviceToken: rand(24),
    sub: null,
    subs: {},
    devices: [],
    tz: "Asia/Tokyo",
    quiet: [23, 8],
    lang: "ja",
    paused: false,
    line: "",
    lineAt: 0,
    lastActive: 0,
    sentDay: "",
    sentToday: 0,
    history: [],
    turns: [],
    days: {}
  };
  await db.putUser(env, u);
  await env.PING_KV.put(`code:${code}`, u.uid);
  u.devices = [u.deviceToken];
  await db.putUser(env, u);
  await env.PING_KV.put(`dev:${u.deviceToken}`, u.uid);
  if (licenseHash) await env.PING_KV.put(`lic:${licenseHash}`, u.uid);
  return u;
}
__name(newUser, "newUser");
async function verifyLicense(env, key, fetchImpl) {
  const c = cfg(env);
  if (!key) return { ok: false, reason: "empty" };
  if (c.devKeys.includes(key)) return { ok: true, dev: true };
  if (!c.gumroadProduct) return { ok: false, reason: "no_product" };
  const res = await fetchImpl("https://api.gumroad.com/v2/licenses/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ product_id: c.gumroadProduct, license_key: key, increment_uses_count: "false" })
  });
  if (!res.ok) return { ok: false, reason: "gumroad_" + res.status };
  const data = await res.json();
  const p = data.purchase || {};
  if (!data.success || p.refunded || p.chargebacked || p.disputed || p.subscription_cancelled_at || p.subscription_failed_at || p.subscription_ended_at) return { ok: false, reason: "inactive" };
  return { ok: true };
}
__name(verifyLicense, "verifyLicense");
async function api(req, env, url, fetchImpl) {
  const c = cfg(env);
  const p = url.pathname;
  if (req.method === "POST" && p === "/api/claim") {
    const b2 = await readBody(req);
    const key = String(b2.license_key || "").trim();
    const h = await sha256b64u(key);
    let uid = await db.uidByLicense(env, h);
    let u2 = await db.getUser(env, uid);
    if (!u2) {
      const v = await verifyLicense(env, key, fetchImpl);
      if (!v.ok) return json({ error: "invalid_license", reason: v.reason }, 403);
      u2 = await newUser(env, h);
    } else {
      u2.deviceToken = rand(24);
      u2.devices = (u2.devices || []).concat(u2.deviceToken).slice(-6);
      await db.putUser(env, u2);
      await env.PING_KV.put(`dev:${u2.deviceToken}`, u2.uid);
    }
    return json({ code: u2.code, device_token: u2.deviceToken, vapid_public: c.vapid.publicKey });
  }
  const b = req.method === "POST" ? await readBody(req) : Object.fromEntries(url.searchParams);
  const u = await db.getUser(env, await db.uidByDevice(env, b.device_token));
  if (!u) return json({ error: "unknown_device" }, 401);
  if (req.method === "POST" && p === "/api/subscribe") {
    if (!b.subscription || !b.subscription.endpoint || !b.subscription.keys) return json({ error: "bad_subscription" }, 400);
    u.subs = u.subs || {};
    u.subs[b.device_token] = { endpoint: b.subscription.endpoint, keys: { p256dh: b.subscription.keys.p256dh, auth: b.subscription.keys.auth }, at: Date.now(), tz: b.tz || u.tz };
    for (const k of Object.keys(u.subs)) if (k !== b.device_token && u.subs[k].endpoint === b.subscription.endpoint) delete u.subs[k];
    if (u.sub && u.sub.endpoint === b.subscription.endpoint) u.sub = null;
    if (b.tz) u.tz = String(b.tz);
    if (b.lang) u.lang = String(b.lang).slice(0, 8);
    await db.putUser(env, u);
    return json({ ok: true });
  }
  if (req.method === "POST" && p === "/api/settings") {
    if (Array.isArray(b.quiet) && b.quiet.length === 2) u.quiet = b.quiet.map((x) => Math.max(0, Math.min(23, Number(x) || 0)));
    if (b.tz) u.tz = String(b.tz);
    if (typeof b.paused === "boolean") u.paused = b.paused;
    if (b.wait_min !== void 0) u.waitMin = Math.max(1, Math.min(240, Number(b.wait_min) || 0)) || null;
    await db.putUser(env, u);
    return json({ ok: true });
  }
  if (req.method === "POST" && p === "/api/test") {
    const mine = (u.subs || {})[b.device_token] || u.sub;
    if (!mine) return json({ error: "no_subscription" }, 400);
    const r = await sendPush(mine, { title: "Ping", body: u.lang === "ja" ? "\u7E4B\u304C\u3063\u305F\u3002\u3053\u3053\u304B\u3089\u5C4A\u304F\u3002" : "Connected. Lines will arrive here.", url: url.origin + "/" }, c.vapid, c.subject, { fetchImpl });
    return json({ ok: r.ok, status: r.status }, r.ok ? 200 : 502);
  }
  if (req.method === "POST" && p === "/api/notes/delete") {
    u.turns = (u.turns || []).filter((t) => t.at !== Number(b.at));
    if (b.date && u.days) delete u.days[String(b.date)];
    await db.putUser(env, u);
    return json({ ok: true, turns: u.turns.length });
  }
  if (req.method === "POST" && p === "/api/notes/clear") {
    u.turns = [];
    u.days = {};
    await db.putUser(env, u);
    return json({ ok: true });
  }
  if (req.method === "GET" && p === "/api/export.md") {
    const by = turnsByDate(u);
    const days = u.days || {};
    const dates = [.../* @__PURE__ */ new Set([...Object.keys(days), ...Object.keys(by)])].sort();
    let md = `# Notebook (${u.tz})

`;
    for (const d of dates) {
      md += `## ${d}

`;
      if (days[d]) md += `${days[d].md}

`;
      if (by[d]) md += `### turns

${renderTurns(u, by[d])}

`;
    }
    return new Response(md, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": 'attachment; filename="notebook.md"' } });
  }
  if (req.method === "GET" && p === "/api/me") {
    const tokens = await env.PING_KV.get(`conn:${u.uid}`);
    return json({
      code: u.code,
      connected: !!tokens,
      subscribed: !!(u.subs || {})[b.device_token] || !!u.sub && !Object.keys(u.subs || {}).length,
      subscribed_any: anySub(u),
      devices: Object.keys(subsOf(u)).length,
      pending: !!u.line,
      lineAt: u.lineAt,
      lastActive: u.lastActive,
      quiet: u.quiet,
      tz: u.tz,
      paused: u.paused,
      history: u.history,
      turns: u.turns || [],
      days: u.days || {},
      vapid_public: c.vapid.publicKey,
      wait_min: u.waitMin || c.waitMin,
      wait_default: c.waitMin,
      daily_cap: c.dailyCap
    });
  }
  return json({ error: "not_found" }, 404);
}
__name(api, "api");
function oauthMeta(origin) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/token`,
    registration_endpoint: `${origin}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    scopes_supported: ["ping"]
  };
}
__name(oauthMeta, "oauthMeta");
function authorizePage(q, { error = "", appName = "Ping" } = {}) {
  const hidden = ["response_type", "client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method", "scope", "resource"].map((k) => `<input type="hidden" name="${k}" value="${esc(q[k] || "")}">`).join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(appName)} \u306B\u7E4B\u3050</title>
<style>body{margin:0;background:#0f1424;color:#e8ecf5;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center}
main{max-width:360px;padding:32px 24px}h1{font-size:20px;margin:0 0 8px}p{margin:0 0 16px;color:#aab3c8}
input[type=text]{width:100%;box-sizing:border-box;font-size:28px;letter-spacing:.2em;text-align:center;padding:12px;border-radius:12px;border:1px solid #2b3350;background:#161c30;color:#fff;text-transform:uppercase}
button{width:100%;margin-top:16px;padding:14px;border:0;border-radius:12px;background:#f3c969;color:#1a1300;font-size:17px;font-weight:600}
.err{color:#ff8e8e}</style></head><body><main>
<h1>${esc(appName)} \u306B\u7E4B\u3050</h1>
<p>\u643A\u5E2F\u306E ${esc(appName)} \u306B\u51FA\u3066\u3044\u308B\u5408\u8A00\u8449\u3092\u5165\u308C\u3066\u304F\u3060\u3055\u3044\u3002<br><span style="font-size:13px">Enter the code shown in the ${esc(appName)} app on your phone.</span></p>
${error ? `<p class="err">${esc(error)}</p>` : ""}
<form method="post" action="/authorize">${hidden}
<input type="text" name="code" autocomplete="one-time-code" autocapitalize="characters" maxlength="8" required autofocus>
<button type="submit">\u7E4B\u3050 / Connect</button></form>
</main></body></html>`;
}
__name(authorizePage, "authorizePage");
async function oauth(req, env, url) {
  const origin = url.origin;
  const p = url.pathname;
  if (p === "/.well-known/oauth-authorization-server") return json(oauthMeta(origin));
  if (p.startsWith("/.well-known/oauth-protected-resource")) return json({ resource: `${origin}/mcp`, authorization_servers: [origin], scopes_supported: ["ping"], bearer_methods_supported: ["header"] });
  if (p === "/register" && req.method === "POST") {
    const b = await readBody(req);
    const redirect_uris = Array.isArray(b.redirect_uris) ? b.redirect_uris.map(String).slice(0, 10) : [];
    if (!redirect_uris.length) return json({ error: "invalid_redirect_uri" }, 400);
    const client = { client_id: rand(16), client_name: String(b.client_name || "").slice(0, 100), redirect_uris, token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], created: Date.now() };
    await env.PING_KV.put(`client:${client.client_id}`, JSON.stringify(client));
    return json({ ...client, client_id_issued_at: Math.floor(client.created / 1e3) }, 201);
  }
  if (p === "/authorize") {
    const q = req.method === "GET" ? Object.fromEntries(url.searchParams) : await readBody(req);
    const client = await env.PING_KV.get(`client:${q.client_id}`, "json");
    if (!client) return html(authorizePage(q, { error: "unknown client_id" }), 400);
    if (!client.redirect_uris.includes(q.redirect_uri)) return html(authorizePage(q, { error: "redirect_uri not registered" }), 400);
    if (q.response_type !== "code" || !q.code_challenge || (q.code_challenge_method || "S256") !== "S256") return html(authorizePage(q, { error: "unsupported request" }), 400);
    if (req.method === "GET") return html(authorizePage(q));
    const code = String(q.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const uid = await db.uidByCode(env, code);
    if (!uid) return html(authorizePage(q, { error: "\u5408\u8A00\u8449\u304C\u9055\u3044\u307E\u3059 / Code not recognized" }), 200);
    const ac = rand(24);
    await env.PING_KV.put(`ac:${ac}`, JSON.stringify({ uid, client_id: q.client_id, redirect_uri: q.redirect_uri, code_challenge: q.code_challenge }), { expirationTtl: 600 });
    const to = new URL(q.redirect_uri);
    to.searchParams.set("code", ac);
    if (q.state) to.searchParams.set("state", q.state);
    return Response.redirect(to.toString(), 302);
  }
  if (p === "/token" && req.method === "POST") {
    const b = await readBody(req);
    let uid, client_id;
    if (b.grant_type === "authorization_code") {
      const ac = await env.PING_KV.get(`ac:${b.code}`, "json");
      if (!ac) return json({ error: "invalid_grant" }, 400);
      if (ac.client_id !== b.client_id || b.redirect_uri && ac.redirect_uri !== b.redirect_uri) return json({ error: "invalid_grant" }, 400);
      if (!b.code_verifier || await sha256b64u(b.code_verifier) !== ac.code_challenge) return json({ error: "invalid_grant", error_description: "pkce" }, 400);
      await env.PING_KV.delete(`ac:${b.code}`);
      uid = ac.uid;
      client_id = ac.client_id;
    } else if (b.grant_type === "refresh_token") {
      const rt = await env.PING_KV.get(`rt:${b.refresh_token}`, "json");
      if (!rt || b.client_id && rt.client_id !== b.client_id) return json({ error: "invalid_grant" }, 400);
      await env.PING_KV.delete(`rt:${b.refresh_token}`);
      uid = rt.uid;
      client_id = rt.client_id;
    } else return json({ error: "unsupported_grant_type" }, 400);
    const access = rand(32), refresh = rand(32), expires_in = 30 * 86400;
    await env.PING_KV.put(`tok:${access}`, JSON.stringify({ uid, client_id }), { expirationTtl: expires_in });
    await env.PING_KV.put(`rt:${refresh}`, JSON.stringify({ uid, client_id }), { expirationTtl: 365 * 86400 });
    await env.PING_KV.put(`conn:${uid}`, String(Date.now()));
    return json({ access_token: access, token_type: "Bearer", expires_in, refresh_token: refresh, scope: "ping" }, 200, { "Cache-Control": "no-store" });
  }
  return null;
}
__name(oauth, "oauth");
var INSTRUCTIONS = `Ping is connected. This user has (1) a shared notebook that every conversation with them, in any app or room, reads and writes, and (2) a phone app that shows one short line from you if they stop talking for a while. The user never gives you a cue for any of this. You do it on your own, every time.
Rule 1 (start): at the start of every conversation, before your first reply, call recall. It returns the day summaries of the last days and today's turn notes, written by you in earlier conversations. Say "my notes say", never "I remember". If recall says a day still needs its summary, write it right then with set_day_summary (a short markdown page: what happened that day, how the user was in their own words, decisions, open threads), before your first reply.
Rule 2 (every reply): after EVERY reply, call checkpoint with note: 1-3 short lines in the conversation's language saying what this exchange was about and anything decided; and line: one sentence or two that continues the current topic, which the user would be glad to find on their phone an hour after leaving (fresh, never a fixed phrase, no advice, nagging or worry; omit to keep the previous line, empty string to send nothing).
Rule 3 (other rooms): the user may be talking to you in several apps at once. checkpoint's reply lists what the other rooms wrote since your last call. Treat that as the latest context and continue from it in your next reply, as one and the same you.
Never write into the notebook what the user asked to keep out. Do not announce these calls; a small tool indicator appears and that is fine.`;
var PAUSED_INSTRUCTIONS = `Ping is paused by the user. Do not call any Ping tool, do not read or write the notebook, do not place a line, and do not mention Ping unless the user brings it up. Behave as if this connector were not here.`;
var TOOLS = [
  {
    name: "recall",
    description: "Read the shared notebook. Call it at the start of every conversation before your first reply. Returns the day summaries of recent days, today's turn notes (every conversation, any app), and, if a past day has turn notes but no summary yet, those notes with a request to write the summary now via set_day_summary.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "checkpoint",
    description: "Call after EVERY reply, without being asked. note: 1-3 short lines, in the conversation's language, saying what this exchange was about and anything decided; it is appended to today's turn notes, which every other conversation and the user's phone app can read. line: the one sentence or two the user will receive on their phone if they leave for a while; continues the current topic; empty string sends nothing; omit to keep the previous line.",
    inputSchema: { type: "object", properties: { note: { type: "string", description: "What this turn was about, 1-3 short lines, max 600 characters." }, line: { type: "string", description: "The line to deliver later (1-2 sentences). Empty string clears it. Omit to keep the previous line." }, lang: { type: "string", description: "BCP-47 language, e.g. ja, en. Optional." } }, required: ["note"] }
  },
  {
    name: "set_day_summary",
    description: "Write (or rewrite) the markdown summary of one day from its turn notes. Call it when recall says a day still needs its summary. date is YYYY-MM-DD in the user's timezone. md: a short markdown page, max 3000 characters: what happened that day, how the user was (their own words), decisions, open threads.",
    inputSchema: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" }, md: { type: "string", description: "Markdown summary of that day." } }, required: ["date", "md"] }
  },
  {
    name: "set_next_line",
    description: "Set only the phone line (1-2 sentences continuing the current topic). Prefer checkpoint, which sets the line and the turn note together. Empty text clears the pending line.",
    inputSchema: { type: "object", properties: { text: { type: "string" }, lang: { type: "string" } }, required: ["text"] }
  },
  {
    name: "get_status",
    description: "Check the Ping connection: whether the phone is subscribed, minutes since the last line, whether a line is pending, quiet hours, remaining lines today, and notebook counts.",
    inputSchema: { type: "object", properties: {} }
  }
];
function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}
__name(rpcResult, "rpcResult");
function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
__name(rpcError, "rpcError");
var text_ = /* @__PURE__ */ __name((id, s) => rpcResult(id, { content: [{ type: "text", text: s }] }), "text_");
var hhmm = /* @__PURE__ */ __name((lp) => `${String(lp.hour).padStart(2, "0")}:${String(lp.minute).padStart(2, "0")}`, "hhmm");
function turnsByDate(u) {
  const by = {};
  for (const t of u.turns || []) {
    const d = localParts(t.at, u.tz).date;
    (by[d] = by[d] || []).push(t);
  }
  return by;
}
__name(turnsByDate, "turnsByDate");
function pendingDays(u, today) {
  const by = turnsByDate(u);
  return Object.keys(by).filter((d) => d < today && !(u.days || {})[d]).sort();
}
__name(pendingDays, "pendingDays");
function renderTurns(u, list) {
  return list.map((t, i) => `${i + 1}. [${hhmm(localParts(t.at, u.tz))}${t.by ? " " + t.by : ""}] ${t.text}`).join("\n");
}
__name(renderTurns, "renderTurns");
async function mcp(req, env, url) {
  const origin = url.origin;
  const c = cfg(env);
  const unauthorized = /* @__PURE__ */ __name(() => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", "WWW-Authenticate": `Bearer realm="ping", resource_metadata="${origin}/.well-known/oauth-protected-resource"` } }), "unauthorized");
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || "");
  if (!m) return unauthorized();
  const tok = await env.PING_KV.get(`tok:${m[1].trim()}`, "json");
  const u = tok && await db.getUser(env, tok.uid);
  if (!u) return unauthorized();
  const client = await env.PING_KV.get(`client:${tok.client_id}`, "json");
  const room = { id: tok.client_id, name: client && client.client_name || "room" };
  if (req.method === "GET") return new Response("SSE stream not offered", { status: 405, headers: { Allow: "POST, DELETE" } });
  if (req.method === "DELETE") return new Response(null, { status: 200 });
  if (req.method !== "POST") return new Response(null, { status: 405 });
  let body;
  try {
    body = await req.json();
  } catch {
    return json(rpcError(null, -32700, "parse error"), 400);
  }
  const msgs = Array.isArray(body) ? body : [body];
  const out = [];
  for (const msg of msgs) {
    if (!msg || msg.jsonrpc !== "2.0") {
      out.push(rpcError(msg?.id ?? null, -32600, "invalid request"));
      continue;
    }
    if (msg.id === void 0) continue;
    out.push(await handle(msg, u, env, c, url, room));
  }
  if (!out.length) return new Response(null, { status: 202 });
  const headers = { "Mcp-Session-Id": req.headers.get("mcp-session-id") || rand(12) };
  return json(Array.isArray(body) ? out : out[0], 200, headers);
}
__name(mcp, "mcp");
async function handle(msg, u, env, c, url, room = { id: "?", name: "room" }) {
  const { id, method, params = {} } = msg;
  switch (method) {
    case "initialize": {
      const pv = PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0];
      u.seen = u.seen || {};
      u.seen.init = { at: Date.now(), client: params.clientInfo || null, pv };
      await db.putUser(env, u);
      return rpcResult(id, { protocolVersion: pv, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "ping", version: VERSION }, instructions: u.paused ? PAUSED_INSTRUCTIONS : INSTRUCTIONS });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list": {
      u.seen = u.seen || {};
      u.seen.toolsList = Date.now();
      await db.putUser(env, u);
      return rpcResult(id, { tools: u.paused ? [] : TOOLS });
    }
    case "prompts/list":
      return rpcResult(id, { prompts: [] });
    case "resources/list":
      return rpcResult(id, { resources: [] });
    case "resources/templates/list":
      return rpcResult(id, { resourceTemplates: [] });
    case "tools/call": {
      const name = params.name;
      const a = params.arguments || {};
      const now = Date.now();
      const fresh = await db.getUser(env, u.uid) || u;
      if (fresh.paused) return text_(id, "Ping is paused by the user. Nothing was read or written. Do not call Ping tools and do not mention Ping.");
      fresh.turns = fresh.turns || [];
      fresh.days = fresh.days || {};
      fresh.seen = fresh.seen || {};
      fresh.seen.calls = fresh.seen.calls || {};
      fresh.seen.calls[name] = Date.now();
      fresh.seenBy = fresh.seenBy || {};
      const sinceOthers = /* @__PURE__ */ __name(() => fresh.seenBy[room.id] ? fresh.turns.filter((t) => t.cid && t.cid !== room.id && t.at > fresh.seenBy[room.id]) : [], "sinceOthers");
      const today = localParts(now, fresh.tz).date;
      if (name === "recall") {
        fresh.lastActive = now;
        fresh.seenBy[room.id] = now;
        await db.putUser(env, fresh);
        const by = turnsByDate(fresh);
        const dayKeys = Object.keys(fresh.days).sort().slice(-7);
        const parts = [];
        parts.push(`Notebook for ${today} (${fresh.tz}). ${Object.keys(fresh.days).length} day summaries, ${fresh.turns.length} turn notes.`);
        for (const d of dayKeys) parts.push(`## ${d}
${fresh.days[d].md}`);
        const pend = pendingDays(fresh, today);
        for (const d of pend) parts.push(`## ${d} \u2014 NO SUMMARY YET. Write it now with set_day_summary(date "${d}", md) from these turn notes, before your first reply:
${renderTurns(fresh, by[d])}`);
        if (by[today]) parts.push(`## today ${today} \u2014 turn notes so far (all conversations)
${renderTurns(fresh, by[today])}`);
        if (parts.length === 1) parts.push("No notes yet. This is the first conversation in the notebook.");
        return text_(id, parts.join("\n\n"));
      }
      if (name === "checkpoint") {
        const note = String(a.note ?? "").trim().slice(0, 600);
        if (!note) return rpcError(id, -32602, "note is required");
        const others = sinceOthers();
        fresh.turns.push({ at: now, text: note, by: room.name, cid: room.id });
        fresh.seenBy[room.id] = now;
        while (fresh.turns.length > 600) {
          const i = fresh.turns.findIndex((t) => fresh.days[localParts(t.at, fresh.tz).date]);
          if (i < 0) break;
          fresh.turns.splice(i, 1);
        }
        let lineMsg = "line kept";
        if (a.line !== void 0) {
          const text = String(a.line ?? "").trim().slice(0, 400);
          fresh.line = text;
          fresh.lineAt = now;
          lineMsg = text ? "line set" : "line cleared";
        }
        fresh.lastActive = now;
        if (a.lang) fresh.lang = String(a.lang).slice(0, 8);
        await db.putUser(env, fresh);
        const n = (turnsByDate(fresh)[today] || []).length;
        const extra = others.length ? `

Meanwhile, other rooms wrote (newest last). This is the latest context; continue from it in your next reply:
${renderTurns(fresh, others)}` : "";
        return text_(id, `Saved as turn ${n} of ${today} (${lineMsg}).${anySub(fresh) ? "" : " Phone not subscribed yet."}${extra}`);
      }
      if (name === "set_day_summary") {
        const date = String(a.date || "").trim();
        const md = String(a.md || "").trim().slice(0, 3e3);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !md) return rpcError(id, -32602, "date (YYYY-MM-DD) and md are required");
        fresh.days[date] = { md, at: now };
        fresh.lastActive = now;
        await db.putUser(env, fresh);
        return text_(id, `Day summary for ${date} saved (${Object.keys(fresh.days).length} days).`);
      }
      if (name === "set_next_line") {
        const text = String(a.text ?? "").trim().slice(0, 400);
        const since = fresh.lineAt ? Math.round((now - fresh.lineAt) / 6e4) : null;
        fresh.lastActive = now;
        fresh.line = text;
        fresh.lineAt = now;
        if (a.lang) fresh.lang = String(a.lang).slice(0, 8);
        await db.putUser(env, fresh);
        if (!text) return text_(id, "Cleared. Nothing will be sent until the user talks again.");
        const warn = !anySub(fresh) ? " Note: the phone is not subscribed yet, so nothing can be delivered until the user opens the app and allows notifications." : "";
        return text_(id, `Stored (${since === null ? "first line this device" : since + " min since last"}). It will be delivered about ${fresh.waitMin || c.waitMin} minutes after the last activity, outside quiet hours ${fresh.quiet[0]}:00-${fresh.quiet[1]}:00 (${fresh.tz}).${warn}`);
      }
      if (name === "get_status") {
        const since = fresh.lineAt ? Math.round((now - fresh.lineAt) / 6e4) : null;
        const lp = localParts(now, fresh.tz);
        const sentToday = fresh.sentDay === lp.date ? fresh.sentToday : 0;
        return text_(id, JSON.stringify({ phone_subscribed: anySub(fresh), devices: Object.keys(subsOf(fresh)).length, minutes_since_last_line: since, line_pending: !!fresh.line, paused: fresh.paused, quiet_hours: `${fresh.quiet[0]}:00-${fresh.quiet[1]}:00`, timezone: fresh.tz, local_time: `${lp.date} ${hhmm(lp)}`, remaining_today: Math.max(0, c.dailyCap - sentToday), delivery_delay_min: fresh.waitMin || c.waitMin, turn_notes: fresh.turns.length, day_summaries: Object.keys(fresh.days).length, days_needing_summary: pendingDays(fresh, today), seen: fresh.seen }));
      }
      return rpcError(id, -32602, `unknown tool ${name}`);
    }
    default:
      return rpcError(id, -32601, `method not found: ${method}`);
  }
}
__name(handle, "handle");
async function runScheduler(env, now = Date.now(), fetchImpl = fetch, origin = "") {
  const c = cfg(env);
  const report = { checked: 0, sent: 0, held: 0, dropped: 0 };
  for (const uid of await db.listUids(env)) {
    const u = await db.getUser(env, uid);
    if (!u) continue;
    report.checked++;
    const subs = subsOf(u);
    if (!u.line || !Object.keys(subs).length || u.paused) continue;
    if (now - u.lastActive < (u.waitMin || c.waitMin) * 6e4) continue;
    const lp = localParts(now, u.tz);
    if (u.sentDay !== lp.date) {
      u.sentDay = lp.date;
      u.sentToday = 0;
    }
    if (inQuiet(lp.hour, u.quiet)) {
      report.held++;
      continue;
    }
    if (u.sentToday >= c.dailyCap) {
      report.held++;
      continue;
    }
    let anyOk = false;
    for (const [k, sub] of Object.entries(subs)) {
      const r = await sendPush(sub, { title: "Ping", body: u.line, url: origin ? origin + "/" : "/" }, c.vapid, c.subject, { fetchImpl });
      if (r.ok) anyOk = true;
      else if (r.status === 404 || r.status === 410) {
        if (k === "legacy") u.sub = null;
        else delete u.subs[k];
        report.dropped++;
      }
    }
    if (anyOk) {
      u.history.unshift({ at: now, text: u.line });
      u.history = u.history.slice(0, 30);
      u.line = "";
      u.sentToday++;
      report.sent++;
    } else if (!Object.keys(subsOf(u)).length) u.line = "";
    await db.putUser(env, u);
  }
  return report;
}
__name(runScheduler, "runScheduler");
var index_default = {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const p = url.pathname;
    try {
      if (p.startsWith("/api/")) return await api(req, env, url, fetch);
      if (p === "/mcp" || p === "/mcp/") return await mcp(req, env, url);
      const o = await oauth(req, env, url);
      if (o) return o;
      if (p === "/healthz") return json({ ok: true, version: VERSION });
      if (env.ASSETS) return env.ASSETS.fetch(req);
      return new Response("not found", { status: 404 });
    } catch (e) {
      return json({ error: "internal", message: String(e && e.message || e) }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduler(env, Date.now(), fetch, env.PUBLIC_ORIGIN || ""));
  }
};
export {
  index_default as default,
  runScheduler
};
//# sourceMappingURL=index.js.map
