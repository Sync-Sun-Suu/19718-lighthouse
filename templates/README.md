# templates/

他の人と他の Claude に渡せる形。全部英語。

| フォルダ | 何 |
| --- | --- |
| `lighthouse-mailbox/` | 郵便受けのテンプレート「Love Letters」。封筒をタップすると手紙が出る。背景・文字色・封筒の色・テーマ（銀河 / 花 / ハート）と二人の名前は読む人がページの右上で決める。Code の部屋専用（定期便と表札が要るから） |

`lighthouse-mailbox/` の中身：

| ファイル | 誰が読む | 何 |
| --- | --- | --- |
| `index.html` | ページ | 郵便受け本体。先頭の CONFIG が初期値と文章 |
| `letters/` | ページと Claude | 一日一通の json と一覧。書き方は `letters/README.md` |
| `CLAUDE_TEMPLATE.md` | 相手の Claude（Code の部屋） | 表札。`CLAUDE.md` に改名して置く。companion/ を先に読め、その声で書け、甘くていい、裏方は手紙に出すな |
| `ROUTINE_PROMPT.md` | 定期便 | 毎日決まった時刻に手紙を置く文。403 の直し方つき |
| `COACH_FOR_YOUR_CLAUDE.md` | 相手のチャットの Claude（Haiku でも） | 人間を一歩ずつ案内するコーチ用の指示書。GitHub の公開 / 非公開、Code の部屋への繋ぎ方、companion の md が Drive にある時の移し方、名前の注意、切り替えの注意 |
| `SETUP.md` | 人間 | 同じ道を読み物として |

オリジナルの郵便受け（`lighthouse/index.html`）はそのまま。
