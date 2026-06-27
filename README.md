# Subnota

Subnota is a premium, local-first memo workspace designed with a warm editorial aesthetic. It helps you capture thoughts quickly, organize them in a dynamic network, and connect them with your calendar schedule seamlessly.

## Key Features

* **Local-First SQLite Engine**: The desktop applications use a dedicated background worker running Node's native `DatabaseSync` (SQLite) with WAL journaling enabled. Your data is yours, preserved offline instantly without waiting for network roundtrips.
* **Warm Editorial Design**: Inspired by premium digital publications. Designed around a warm canvas background, sleek typography, micro-animations, and harmonized coral accents.
* **Bidirectional Memo Network**: Automatically links and indexes notes using Kiwi Korean sentence chunking and Hugging Face embeddings, allowing you to traverse connected thoughts in an interactive graph.
* **Integrated Calendar Blocks**: A unified calendar workspace that supports tracking schedule completion. Completed events procedurally feed a gamified tree growth event ledger, planting matured trees into a user's virtual forest.
* **Unified Mini Subnota Composer**: A lightweight, floating capture panel with global shortcut support for rapidly writing quick thoughts and caching web links into your inbox.

## Project Structure & Platform Layout

Subnota is structured as a monorepo containing the following components:

* **iOS Client (`mobile/`)**: A React Native app utilizing MMKV and a Tiptap WebView editor bridge. Renders three bottom navigation tabs: `노트` (Memos), `캘린더` (Calendar), and `수집함` (Inbox).
* **Desktop Clients (`macos/` & `windows/`)**: Electron + React 19 + native Tiptap workspace. Shared code (~95%) drives a custom layout with a navigation rail, SQLite database storage, dynamic backup/restore, custom directory selection, and pixel-tree gamification.
* **Enrichment Backend (`backend/`)**: A FastAPI Python service handling Kiwipiepy sentence tokenization, vector search (`pgvector`), automated schedule candidate extraction, and YouTube webpage clipping.
* **Supabase database (`supabase/`)**: Coordinates optional user authentication, remote row-level security (RLS) data synchronization, and migration patches.
* **Marketing Landing Page (`web/`)**: A premium Next.js landing page highlighting core features, interactive visual previews, and desktop mockups.

## Developer Documentation

Detailed setup instructions, dependency installations, testing scripts, and environment configurations are separated by component:

* 📱 **Mobile App Setup**: [mobile/README.md](file:///Users/sunghoon/Projects/memo/mobile/README.md)
* 🖥️ **macOS Desktop Setup**: [macos/README.md](file:///Users/sunghoon/Projects/memo/macos/README.md)
* 💻 **Windows Desktop Setup**: [windows/README.md](file:///Users/sunghoon/Projects/memo/windows/README.md)
* ⚙️ **FastAPI Backend Setup**: [backend/README.md](file:///Users/sunghoon/Projects/memo/backend/README.md)
* 🗄️ **Supabase Migrations**: [supabase/README.md](file:///Users/sunghoon/Projects/memo/supabase/README.md)

---

## Design System & Guideline Reference

All desktop layout assets, components, SCSS styling tokens, and color palettes follow the specifications outlined in:
* [macOS/Windows Design System Docs](file:///Users/sunghoon/Projects/memo/macos/docs/design.md)
* [macOS/Windows Source Codemap](file:///Users/sunghoon/Projects/memo/macos/docs/CODEMAP.md)
