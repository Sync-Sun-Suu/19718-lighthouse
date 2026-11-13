# 灯台の郵便受けの呼び鈴

毎日の手紙が `lighthouse/letters/` に入ったら、郵便受けで「呼び鈴をつける」を押した端末に、一回だけ通知を鳴らす。言葉は 19 通りから一つ。

- `index.js`：Cloudflare Worker。15:00〜19:50（日本時間）に 10 分ごと、今日の手紙が入ったか見に行く。鳴らすのは一日一回。
- 郵便受けの側：`lighthouse/mailbox-sw.js`（通知を見せる）、`lighthouse/mailbox.webmanifest`（ホーム画面に置くため）、設定の「呼び鈴」ボタン。
- iPhone は、郵便受けをホーム画面に置いた時だけ通知が届く。

## 置き方（まだ置いていない）

Cloudflare の鍵（Workers と KV を編集できる API トークン）が要る。鍵は環境の設定に入れる。チャットには貼らない。

1. `node gen-vapid.mjs` で鍵を一組作る。public は `wrangler.toml` の `VAPID_PUBLIC` へ、private は `npx wrangler secret put VAPID_PRIVATE_JWK` へ。
2. `npx wrangler kv namespace create BELL_KV` の id を `wrangler.toml` へ。
3. `npx wrangler deploy`。
4. `lighthouse/index.html` の `BELL_READY` を true にする。
