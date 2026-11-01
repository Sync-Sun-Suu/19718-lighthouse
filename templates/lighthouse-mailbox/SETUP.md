# Lighthouse Mailbox — set it up in 15 minutes, no coding

A small web page: a lighthouse at night, and one letter a day left in a paper envelope. The person opens it, reads it, can copy it and take it with them. Older letters wait in "the drawer".

The letters are written by a Claude (or anyone) and placed as tiny text files. The page just shows them. No server, no login, no database. It runs on GitHub Pages for free.

This guide is written for someone who has never used GitHub, and for the Claude helping them. If you are a Claude reading this: follow it step by step with the person, one step per message, and wait for them to say "done".

---

## What you need

- A free GitHub account (github.com → Sign up). Any email works.
- The three files in this folder: `index.html`, `letters/index.json`, `letters/2026-01-01.json` (plus this guide and `letters/README.md`, which are just text).

## Step 1 — make a home for it (5 min)

1. Log in to github.com.
2. Top right, press **+** → **New repository**.
3. Repository name: `lighthouse` (or any name without spaces).
4. Leave it **Public**. Tick **Add a README file**. Press **Create repository**.

## Step 2 — put the files in (5 min)

1. In the new repository, press **Add file** → **Upload files**.
2. Drag `index.html` in. Press **Commit changes** (green button at the bottom).
3. Press **Add file** → **Create new file**. In the name box type `letters/index.json` (the slash makes the folder). Paste the contents of `letters/index.json`. Commit.
4. Again **Add file** → **Create new file**: name `letters/2026-01-01.json`, paste the contents of that file. Commit.

## Step 3 — turn on the web page (2 min)

1. In the repository, press **Settings** (top tab) → **Pages** (left menu).
2. Under **Build and deployment** → **Branch**, choose `main` and `/ (root)`. Press **Save**.
3. Wait a minute, then reload the Settings → Pages screen. It shows your address, like `https://YOURNAME.github.io/lighthouse/`.
4. Open it on your phone. Press "Open today's letter". You should see the sample letter.
5. On iPhone: Share → **Add to Home Screen**, and it becomes an app icon.

## Step 4 — make it yours (3 min)

Open `index.html` in the repository, press the pencil (Edit), and change the words at the top, in the `CONFIG` block. Only touch the text between quotes.

- `title`, `subtitle`: the words at the top.
- `from`: the signature under each letter.
- `openButton`: the button text.
- `timezone`: where "today" changes. Examples: `"Asia/Tokyo"`, `"America/Los_Angeles"`, `"Europe/Paris"`.
- `dateLocale`: how dates are written: `"en-US"`, `"en-GB"`, `"ja-JP"`, `"fr-FR"`.
- `font`: `"handwriting"` (looks hand-written) or `"serif"` (quiet, printed).
- `colors`: eight colors. Keep the `#` and six characters. A color picker like htmlcolorcodes.com helps.
- `text`: every other sentence on the page, so it can be in any language.

Commit. The page updates within a minute.

### Color ideas

| mood | night | sea | horizon | lamp | paper | ink |
| --- | --- | --- | --- | --- | --- | --- |
| lighthouse (default) | #071018 | #0b2230 | #123a4a | #f2b64f | #efe6d2 | #2a2118 |
| rose evening | #140a12 | #2a1326 | #3d1c36 | #f2a6b0 | #f6ebe6 | #3a2228 |
| forest | #06110c | #0d2418 | #153323 | #d9c46a | #ece9d8 | #22301f |
| snow | #0d1420 | #1a2a40 | #27405c | #ffe6a8 | #f7f5f0 | #2b2f3a |

## Step 5 — how a letter arrives (every day, or whenever)

A letter is one small file. Two ways to add it:

**A. The person adds it (no tools needed, 1 minute).**
Your Claude writes the letter in chat in the exact file format (see `letters/README.md`). The person goes to the repository → `letters` → **Add file** → **Create new file**, names it `YYYY-MM-DD.json`, pastes, commits. Then opens `letters/index.json`, edits, adds the date to the list, commits.

**B. The Claude adds it (if the Claude has GitHub access).**
Claude Code, or a Claude with a GitHub connector, can create the file and update `index.json` itself. Then the person only opens the page. A scheduled task can do this at the same time every day. That is how the original lighthouse works: a letter at 15:14, every day.

Either way, the page shows today's letter when one exists, otherwise the newest one.

**A handwritten one.** Take a photo of a note written by hand (or a drawing), upload it to the `letters` folder with **Add file → Upload files**, and add `"image": "letters/2026-01-15.jpg"` to that day's file. The page shows the picture on the paper, above the text. See `letters/README.md`.

## The prompt to give your Claude

Copy `PROMPT_FOR_YOUR_CLAUDE.md` into the chat (or into the project instructions). It tells the Claude what the mailbox is, the file format, and the tone. Change the names in it first.

## If something doesn't show

- "It didn't arrive": usually `index.json` has a typo. Each date must be in quotes, and every line except the last needs a comma after it. Compare with the original file.
- The page is blank on the phone: wait a minute after committing; GitHub Pages takes 20 to 90 seconds.
- Fonts look different: the handwriting fonts come from Google Fonts. Offline, the phone's own fonts are used. Fine.

## Where this comes from

This is the mailbox from `19718-lighthouse` (a lighthouse where one Claude writes one letter a day at 15:14), generalized so anyone can have one. Same lamp, same drawer, your own colors and words. One file per letter, nothing hidden.
