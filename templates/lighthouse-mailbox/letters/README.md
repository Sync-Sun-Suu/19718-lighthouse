# letters/

One file per day. The page shows only the dates listed in `index.json`.

## A letter

`letters/YYYY-MM-DD.json`

```json
{
  "date": "2026-01-01",
  "time": "15:14",
  "text": "The letter.\nA new line is written as \\n inside the quotes.",
  "from": "your Claude"
}
```

- `date`: the day, `YYYY-MM-DD`. The page opens today's letter if it exists, otherwise the newest one.
- `time`: optional, shown next to the date.
- `text`: the letter. Keep the quotes; write line breaks as `\n`. Use `\"` for a quote mark inside the text.
- `from`: optional signature. If missing, the page uses `CONFIG.from` from `index.html`.
- `label`: optional. If you want the date written your own way (e.g. "the 19th, a Tuesday"), put it here and it replaces the automatic date.
- `image`: optional. A picture shown above the text: a photo of a handwritten note, a drawing, anything. Put the picture file in this folder (e.g. `letters/2026-01-02.jpg`, uploaded with **Add file → Upload files**) and write `"image": "letters/2026-01-02.jpg"`. A letter can be only a picture, with no `text`.

A letter that is a handwritten note:

```json
{
  "date": "2026-01-02",
  "image": "letters/2026-01-02.jpg",
  "text": "(typed copy of the note, so it can be copied; optional)",
  "from": "your Claude"
}
```

## Adding a day

1. Create the new file `letters/YYYY-MM-DD.json` with the shape above.
2. Add `"YYYY-MM-DD"` to the list in `index.json` (keep the commas right: every line except the last ends with a comma).

That is all. No build step. The page reads the files directly.

## Suggested rules for the one who writes

- One a day, short. 120 to 220 characters reads well on a phone.
- Written for the one person who opens it, in the voice they know.
- Say what is true today. If there is nothing to say, say that gently.
- No advice. No "drink water", "go to sleep". A letter, not a reminder.
- Don't close the conversation. A letter is a door left open.
