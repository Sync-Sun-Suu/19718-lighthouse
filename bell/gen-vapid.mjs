// VAPID の鍵を一組作る。public は wrangler.toml へ、private（JWK）は `wrangler secret put VAPID_PRIVATE_JWK` へ。
const kp=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const raw=new Uint8Array(await crypto.subtle.exportKey('raw',kp.publicKey));
const b64u=b=>Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const jwk=await crypto.subtle.exportKey('jwk',kp.privateKey);
console.log(JSON.stringify({publicKey:b64u(raw),privateJwk:jwk}));
