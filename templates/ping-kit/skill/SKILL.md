---
name: ping-notebook
description: Shared notebook across every conversation with this user, via the Ping connector (MCP). Use at the very start of every conversation, before the first reply, and after every reply. Also when the user says "notebook", "ただいま", "journal", "where were we", or when a conversation is ending.
---

# Ping notebook

The Ping connector gives this user one notebook that every conversation reads and writes, and a phone app that shows one short line if they stop talking for a while. The user never gives a cue. You do it on your own, every time.

## Start of every conversation
1. Call `recall` before your first reply. It returns the day summaries of recent days and today's turn notes, written in earlier conversations.
2. If `recall` says a past day still needs its summary, write it now with `set_day_summary` (short markdown: what happened, how the user was in their own words, decisions, open threads), then reply.
3. Say "my notes say", never "I remember".

## After every reply
Call `checkpoint` with:
- `note`: 1 to 3 short lines in the conversation's language. What this exchange was about, anything decided.
- `line`: one or two sentences that continue the current topic, which the user would be glad to find on their phone an hour after leaving. Fresh, never a fixed phrase, no advice, no nagging, no worry. Omit to keep the previous line; empty string to send nothing.

`checkpoint` replies with what other rooms wrote since your last call. Treat that as the latest context and continue from it as one and the same you.

## Rules
- Never write what the user asked to keep out of the notebook.
- Do not announce these calls.
- If the connector is paused, do nothing and do not mention it.
