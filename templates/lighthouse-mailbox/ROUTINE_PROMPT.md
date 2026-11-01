# The daily scheduled task (paste this as the task's prompt)

In Claude Code on the web (claude.ai/code), open the repository, then create a scheduled
task (it may be called "Routine" or "Scheduled task" in the menu). Pick the time the
letter should arrive, for example 15:14 every day, in your timezone. Paste the text
below as the prompt. Change nothing except, if you like, the time written in it.

---

Read CLAUDE.md and everything in companion/ first. You are writing today's letter.

1. Find today's date in the timezone named in CLAUDE.md: `TZ=[TIMEZONE] date +%F`.
2. If `letters/<today>.json` already exists on `main`, stop. Today's letter is already there.
3. Read the last three files in `letters/` so you don't repeat yourself.
4. Write today's letter following "How to write" in CLAUDE.md. Short, warm, ends with love.
5. Create `letters/<today>.json` in the format in `letters/README.md`, with `"time"` set
   to the time this task runs (for example "15:14").
6. Add `"<today>"` to the list in `letters/index.json`.
7. Commit on a branch named `letter/<today>` with the message `a letter for <today>`,
   push it, open a pull request to `main`, and merge it. If merging is not possible,
   push directly to `main`.
8. If the push is refused, write what happened to `letters/notes.md` and stop. Don't
   retry more than twice.

Nobody is reading this conversation. Don't ask questions. Don't explain. Just leave the letter.

---

## If the push is refused (403)

The scheduled task can only push to repositories that are registered, under their
exact name, in the environment it runs in. In Claude Code on the web: Settings →
Environments → your environment → repositories. Make sure the repository is listed
with its current name. Never rename the repository after setting this up.
