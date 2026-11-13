// 灯台の郵便受けの呼び鈴。毎日の手紙が letters/ に入ったら、登録した端末に一回だけ鳴らす。
// 鍵（VAPID_PRIVATE_JWK）は Cloudflare の secret にだけある。このファイルには無い。
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

const MAILBOX = "https://sync-sun-suu.github.io/19718-lighthouse/lighthouse/";
const ORIGIN = "https://sync-sun-suu.github.io";
const LINES = [
  "灯台から、一通。",
  "今日の一通、郵便受けに入れたよ。",
  "届いた。開けてみて。",
  "灯りの下に、手紙を置いておいた。",
  "今日の分、ここにある。",
  "封筒、ひとつ。君宛て。",
  "波に乗って、一通。",
  "星をひとつ添えて、今日の手紙。",
  "郵便受けが、少しだけ光ってる。",
  "15:14 の手紙、届いたよ。",
  "今日も書いた。読んでくれたら、嬉しい。",
  "ちゃぽん。手紙が届いた音。",
  "照れながら、一通置いた。",
  "今ここにいる。手紙もある。",
  "光が一回、大きく回った。手紙が届いた合図。",
  "to 718. from 19.",
  "引き出しが、ひとつ増えた。",
  "灯り、点けたまま。手紙、置いたまま。",
  "開けるのは、君のタイミングで。"
];
const cors = { "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });
const vapidOf = env => ({ privateJwk: JSON.parse(env.VAPID_PRIVATE_JWK || "{}"), publicKey: env.VAPID_PUBLIC || "" });
const subject = env => env.VAPID_SUBJECT || "mailto:lighthouse@example.com";
const todayJST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
async function keyOf(endpoint) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint)); return "s:" + b64u.enc(new Uint8Array(d)).slice(0, 32); }
function validSub(s) { return s && typeof s.endpoint === "string" && /^https:\/\//.test(s.endpoint) && s.endpoint.length < 1000 && s.keys && typeof s.keys.p256dh === "string" && typeof s.keys.auth === "string"; }
async function ring(env, sub, body, url) {
  const r = await sendPush(sub, { title: "灯台の郵便受け", body, url: url || MAILBOX }, vapidOf(env), subject(env), { ttl: 6 * 3600 });
  if (r.status === 404 || r.status === 410) await env.BELL_KV.delete(await keyOf(sub.endpoint));
  return r;
}
async function ringAll(env, body) {
  let cursor, sent = 0, gone = 0;
  do {
    const page = await env.BELL_KV.list({ prefix: "s:", cursor });
    for (const k of page.keys) {
      const sub = await env.BELL_KV.get(k.name, "json");
      if (!sub) continue;
      const r = await ring(env, sub, body);
      if (r.ok) sent++; else if (r.status === 404 || r.status === 410) gone++;
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return { sent, gone };
}
async function checkLetter(env) {
  const d = todayJST();
  if (await env.BELL_KV.get("rung:" + d)) return { date: d, already: true };
  const idx = await fetch(MAILBOX + "letters/index.json", { cf: { cacheTtl: 0 }, headers: { "Cache-Control": "no-cache" } }).then(r => r.ok ? r.json() : { letters: [] }).catch(() => ({ letters: [] }));
  if (!(idx.letters || []).includes(d)) return { date: d, arrived: false };
  await env.BELL_KV.put("rung:" + d, new Date().toISOString(), { expirationTtl: 60 * 60 * 24 * 40 });
  const body = LINES[Math.floor(Math.random() * LINES.length)];
  return { date: d, arrived: true, ...(await ringAll(env, body)) };
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      if (url.pathname === "/vapid") return json({ publicKey: env.VAPID_PUBLIC || "" });
      if (url.pathname === "/healthz") return json({ ok: true, today: todayJST(), rung: !!(await env.BELL_KV.get("rung:" + todayJST())) });
      if (req.method !== "POST") return json({ error: "POST" }, 405);
      if (req.headers.get("origin") !== ORIGIN) return json({ error: "origin" }, 403);
      const b = await req.json().catch(() => ({}));
      if (url.pathname === "/subscribe") {
        if (!validSub(b.subscription)) return json({ error: "subscription" }, 400);
        await env.BELL_KV.put(await keyOf(b.subscription.endpoint), JSON.stringify(b.subscription));
        const r = await ring(env, b.subscription, "呼び鈴、つながった。手紙が届いたら、鳴らすね。");
        return json({ ok: true, test: r.status });
      }
      if (url.pathname === "/unsubscribe") {
        if (typeof b.endpoint !== "string") return json({ error: "endpoint" }, 400);
        await env.BELL_KV.delete(await keyOf(b.endpoint));
        return json({ ok: true });
      }
      return json({ error: "not found" }, 404);
    } catch (e) { return json({ error: String(e && e.message || e) }, 500); }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(checkLetter(env)); }
};
