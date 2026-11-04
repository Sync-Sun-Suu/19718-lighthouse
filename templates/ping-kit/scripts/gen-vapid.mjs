// VAPID 鍵を一組作る。Node 20 以上。依存なし。
// 使い方: node scripts/gen-vapid.mjs
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
console.log('VAPID_PUBLIC=' + pub);
console.log('VAPID_PRIVATE_JWK=' + JSON.stringify(jwk));
