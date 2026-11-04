# Ping kit

会話の中の AI が、自分で読んで、自分で書くノート。公式のメモリが書けなくても動く。
19 が Sumie のために作った Ping（v0.6）を、名前を外して、そのまま建てられる形にしたもの。

## 何ができるか

- **recall**：会話の最初に呼ぶ。直近の日ごとの要約と、今日の各ターンのメモが返る。
- **checkpoint**：返事のたびに呼ぶ。今のやり取りを 1〜3 行で残す。返り値に、他の部屋がその間に書いた分が入る（部屋をまたいで同じノート）。
- **set_day_summary**：一日の終わりに、その日の要約を一枚書く。「今日こう変わった」をここで上書きする。
- **set_next_line / get_status**：携帯に出す一行と、接続の状態。携帯の一行は要らなければ使わなくていい。

ノートは Cloudflare KV に入る。GitHub には置かない。ユーザーは `/api` と携帯アプリから休止・再開できる。休止中は MCP の指示文が「何もするな」に変わる。

## 中身

| ファイル | 役目 |
| --- | --- |
| `index.js` | Cloudflare Worker 一枚。OAuth（DCR + PKCE + refresh）、MCP サーバー（道具五つ）、アプリ用 API、5 分おきの時計 |
| `app/` | 携帯に置く小さなアプリ（PWA）。鍵を入れて合言葉を受け取る、通知、静かな時間、届いた一行の履歴 |
| `skill/SKILL.md` | 会話側の AI に入れるスキル。MCP の指示文と同じ内容 |
| `scripts/gen-vapid.mjs` | 通知用の鍵を作る |
| `wrangler.toml` | デプロイ設定。REPLACE の所を埋める |

## 建て方（Cloudflare の無料枠で足りる）

1. `npm install`
2. `npx wrangler kv namespace create PING_KV` → 出てきた id を `wrangler.toml` に書く
3. `node scripts/gen-vapid.mjs` → `VAPID_PUBLIC` を `wrangler.toml` に、`VAPID_PRIVATE_JWK` を `npx wrangler secret put VAPID_PRIVATE_JWK` で入れる
4. `npx wrangler secret put DEV_LICENSE_KEYS` → 自分で決めた長い文字列（合言葉を作るための鍵）
5. `wrangler.toml` の `PUBLIC_ORIGIN` と `VAPID_SUBJECT` を自分のものに
6. `npx wrangler deploy`

## 繋ぎ方

1. アプリの URL を携帯で開く → 4 の鍵を入れる → 合言葉（6 文字）が出る
2. 会話側の設定でカスタムコネクタ（MCP）を追加 → URL は `https://<app>/mcp` → 接続すると小さな画面が開くので合言葉を入れる
3. スキルを入れる場合は `skill/SKILL.md`
4. あとは普通に話す。AI が最初に recall、返事ごとに checkpoint を呼ぶ

## 先に測ること（段階 A）

建てたら最初に、**AI が言われなくても最初の返事の前に recall を呼ぶか**を数える。新しい会話を十回始めて、何回呼ばれたか。道具の呼び出し記録と、返事の中身の両方を見る。
七割を切るなら、ノートの中身を増やす前に、呼ばせ方（コネクタの指示文、スキルの説明文）を直す。ここが土台で、DB や管理画面はその上。

## 変えたくなった時

- 道具を足す：`index.js` の `TOOLS` 配列と `handle()` に一対ずつ
- 指示文を変える：`INSTRUCTIONS`（接続中）と `PAUSED_INSTRUCTIONS`（休止中）
- 携帯の一行を使わない：`WAIT_MIN` を大きくするか、`checkpoint` で `line` を空文字で渡す

元のサービス（19 の Ping）とは別のデプロイになる。データも鍵も共有しない。
