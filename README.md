<p align="center">
  <img src="web/public/subnota-mark-glass.png" width="72" alt="Subnota logo" />
</p>

<h1 align="center">Subnota</h1>

<p align="center">
  A local-first note app that reconnects past thoughts, finds schedules in your writing, and keeps saved links useful.
</p>

<p align="center">
  <a href="https://subnota.com">Website</a> ·
  <a href="https://subnota.com/#download">Download</a> ·
  <a href="https://github.com/SUNGHOONOH/Subnota/releases">Releases</a>
</p>

## Overview

Subnota is a local-first workspace for notes, schedules, and saved links.

It surfaces related passages while you write, detects dates in your notes, and
lets you collect useful pages without breaking your workflow. Notes are stored
locally first and can optionally sync across devices after signing in.

The desktop app is available for macOS Apple Silicon and Windows x64.
The iOS app is in development.

## Highlights

- **Connected memory** — Surfaces relevant passages from past notes using an on-device embedding index.
- **Memo to calendar** — Finds dates in your writing and turns them into calendar events.
- **Collect and reuse** — Saves web pages, creates summaries, and connects sources with your notes.
- **Local-first** — Stores notes, schedules, links, and vectors locally in SQLite.
- **Focused workspace** — Combines tabs, split panes, previews, global search, and Quick Subnota.

## Repository structure

| Path | Purpose | Main technologies |
| --- | --- | --- |
| [`desktop/`](desktop/) | macOS and Windows desktop app | Electron, React, Tiptap, SQLite |
| [`mobile/`](mobile/) | iOS app in development | React Native, MMKV, Tiptap |
| [`web/`](web/) | Product website | Next.js, React |
| [`backend/`](backend/) | Search, summaries, schedules, and topic enrichment | FastAPI, Kiwi, Hugging Face |
| [`supabase/`](supabase/) | Authentication, sync schema, RLS, and vector data | PostgreSQL, pgvector |

## Development

Setup and verification instructions are maintained per application:

- [Desktop development](desktop/README.md)
- [Mobile development](mobile/README.md)
- [Web development](web/README.md)
- [Backend development](backend/README.md)
- [Database migrations](supabase/README.md)

For desktop architecture and interface rules, see
[CODEMAP](desktop/docs/CODEMAP.md) and the
[design system](desktop/docs/design.md).
