<div align="center">

<img src="assets/banner.png" alt="Research Dashboard" width="140" />

# Research Dashboard

A **desktop literature manager & AI reading assistant** for researchers and paper lovers.

Built with Tauri + React + Rust — local-first, your data stays fully under your control.

**A cross-platform desktop app for Windows / macOS / Linux.**

**[English](README.md) · [简体中文](README.zh-CN.md)**

</div>

<p align="center">
  <img src="assets/screenshot-home.png" alt="Home Screen" style="border: 1px solid #e0e0e0; border-radius: 8px; margin: 16px 0; max-width: 92%;" />
</p>

---

## ✨ Features

### 📚 Literature Management
- **Paper Library** — centrally manage papers you care about with multi-dimensional filters: keywords, date range, venue (CCF / JCR ranked), and domain.
- **Venue Rankings** — built-in CCF / JCR journal & conference rankings to help you pick where to publish.
- **Flexible Entry** — manually add papers, or one-click import from an arXiv ID with title / authors / abstract auto-filled.
- **PDF Reading** — built-in PDF viewer for quick full-text browsing.

### 🤖 AI Chat Assistant (three modes)
- **AI Chat** — free-form conversation: Q&A, brainstorming, and more.
- **AI Search & Recommend** — the LLM understands your intent → searches your local library → returns explained recommendations.
- **Chapter Summary** — attach a paper PDF (or link an arXiv paper from your library) and let AI summarize chapter by chapter.
- **Multiple backends** — cloud (OpenAI-compatible APIs: Claude / GPT / DeepSeek, etc.) + local (Apple MLX / Ollama-compatible servers).
- Attach PDFs as chat context and ask questions about the paper anytime.

### 🕷️ Scheduled arXiv Crawler
- Periodically / manually crawl the latest arXiv papers for your subscribed domains.
- Smart stopping: halts after consecutive old papers; auto-deduplicates so nothing is stored twice.
- Each paper is written to the database immediately — resumable after network loss.

### 📬 Daily Recommendations
- Gmail OAuth2 integration — automatically sync **Google Scholar Alert** emails and extract papers into your library.
- Papers are auto-matched against existing entries to avoid duplicates.

### ⭐ Subscriptions & Favorites
- **Subscriptions** — subscribe to authors / domains / keywords, and filter the article list by "subscribed authors" in one click.
- **Favorites** — organize papers into multi-level folders, with drag & drop and move support.

### 📈 Reading Stats & History
- Full reading / chat history, grouped by date as a timeline.
- Reading statistics: monthly heatmap, keyword cloud, domain distribution, trend charts, and more.

### 💾 Portable Data
- **Import / Export** — one-click export to a standard `.sql` file, with "all data" or "core data" scope.
- Move data between devices and apps; back up and restore anytime.
- Data lives in local SQLite (`~/.research_dashboard/`) — fully under your control.

### 🎨 Personalization
- Right toolbar panels: freely drag to reorder, collapse / expand.
- Light / Dark / System theme.
- Chinese / English UI.

---

## 🚀 Installation & Usage

**Research Dashboard** is a cross-platform desktop app for **Windows / macOS / Linux** — no development environment required, just download and run.

> Installers are coming soon. Once published, grab the installer for your platform (Windows / macOS / Linux) from the GitHub Releases page.

### Data Directory
All data is stored in `~/.research_dashboard/` by default:

| Path | Contents |
|------|----------|
| `research_dashboard.db` | SQLite database (papers, favorites, subscriptions, history, chats, …) |
| `settings.json` | App settings & model configuration |
| `layout.json` | Right toolbar layout |
| `pdfs/` | PDFs of manually added non-arXiv papers |

> To back up / migrate, export a `.sql` file from **Settings → Import / Export**.

---

## 🛠️ Build from Source (for Developers)

> The following is for developers / contributors. End users don't need any of this — just use the installer.

### Prerequisites
- Node.js ≥ 18
- Rust (stable)
- Tauri 2 system dependencies (Xcode Command Line Tools on macOS)

### Run (development)
```bash
# 1. Install frontend dependencies
npm install

# 2. Launch the full desktop app (starts frontend + Rust backend)
npm run tauri dev
```

### Frontend only (browser debugging)
```bash
npm run dev
```

### Backend CLI
```bash
# Manually trigger an arXiv crawl (works without GUI)
cargo run --manifest-path src-tauri/Cargo.toml -- --crawl
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop framework | [Tauri 2](https://tauri.app) |
| Frontend framework | React 19 + TypeScript |
| UI components | Material-UI (MUI) v9 + Emotion |
| State management | Zustand |
| Routing | React Router |
| Build tool | Vite |
| Charts | Recharts + d3-cloud (word cloud) |
| Drag & drop | dnd-kit |
| i18n | i18next |
| Backend language | Rust |
| Database | SQLite (rusqlite bundled) + r2d2 pool |
| Async runtime | Tokio |
| HTTP client | reqwest |
| HTML parsing | scraper (arXiv crawler) |
| PDF parsing | pdf-extract |
| External integration | Gmail OAuth2 (Google Scholar Alert sync) |

---

## 📁 Project Structure

```
research_dashboard/
├── src/                      # Frontend (React)
│   ├── pages/                # Pages: Home / Articles / Favorites / History / Stats / Daily
│   ├── components/           # Components: layout / article card / settings / stats, etc.
│   ├── stores/               # Zustand state management
│   ├── i18n/                 # zh / en locales
│   └── types/                # TypeScript type definitions
├── src-tauri/                # Backend (Rust + Tauri)
│   ├── src/
│   │   ├── controller/       # Tauri command entry (interface layer)
│   │   ├── service/          # Business logic layer
│   │   ├── dao/              # Data access layer (SQLite CRUD)
│   │   ├── models/           # Data models
│   │   ├── crawler/          # arXiv crawler engine
│   │   ├── llm/              # LLM integrations (cloud / MLX / Ollama)
│   │   ├── gmail/            # Gmail OAuth2 & Scholar Alert sync
│   │   └── settings.rs       # App settings / storage management
│   └── Cargo.toml
├── docs/                     # Design docs
└── package.json
```

---

## 🧭 Architecture & Data Flow

<p align="center">
  <img src="assets/architecture.png" alt="Architecture" style="max-width: 100%;" />
</p>

<p align="center">
  <img src="assets/dataflow.png" alt="Data Flow" style="max-width: 100%;" />
</p>

**Core pipeline**:

```
Data sources (arXiv crawler / Gmail Scholar Alert / manual entry)
        │
        ▼
  Parse & dedupe ──► SQLite local DB (~/.research_dashboard/)
        │                              │
        │                              ▼
        │                    Frontend search / filter / stats / recommend
        │                              │
        └────────────► LLM (cloud / local) — chat / search / chapter summary
```

---

## 🤝 Contributing

This is an open-source desktop app built to make literature management and AI-assisted reading easier. Issues, PRs, and suggestions are all welcome.

## 📄 License

This project is released under the [MIT License](./LICENSE) for learning and personal use.

---

*Made with ❤️ for research & reading.*
