# 📚 Git Notes Viewer

A fast, zero-dependency web platform to browse, search, and study notes, slides, source code, and media directly from any public Git repository — built with pure vanilla HTML, CSS, and JavaScript.

Paste any **GitHub**, **GitLab**, **Codeberg**, **Gitea**, or **Bitbucket** repository link into the launchpad to turn a raw Git repo into an interactive study portal.

## 🚀 Live Deployments

- **Primary Portal:** [git-notes.satya-nayak.dev](https://git-notes.satya-nayak.dev)
- **Cloudflare Mirror:** [git-notes-viewer.pages.dev](https://git-notes-viewer.pages.dev/)

---

## ✨ Key Features

### 🌐 Universal Git Platform Support
- **Hero Launchpad & Omnibox**: Enter any repository URL or shorthand (`owner/repo`, `gl:owner/repo`, `cb:owner/repo`, `bb:owner/repo`) from the home screen to load it instantly.
- **Multi-Platform Adapters**: Native API integration for **GitHub**, **GitLab**, **Codeberg**, **Gitea**, and **Bitbucket**.
- **URL Preloading & Workspace Persistence**: Opening a shared link with `?repo=...` automatically preloads the repository, saves it to your recent workspaces, and routes directly to the target folder or file.
- **Quick Switcher**: Jump between recently visited repositories from the topbar dropdown without reloading the page.

### ⚡ Instant Global Search & Navigation
- **Single-Request Recursive Tree**: Fetches the entire repository tree in a single API call (`git/trees?recursive=1`), enabling zero-latency folder navigation and preserving API rate limits.
- **Global Subfolder Search**: Press `/` or `Ctrl+K` to filter across every file and nested directory in the repository simultaneously, complete with parent-folder path badges.
- **Pinned / Starred Resources (`⭐`)**: Pin frequently used cheatsheets, PDFs, or lecture notes to the top of your workspace for one-click access during exams.
- **Sibling File Navigation (`‹` / `›`)**: Flip directly to the previous or next viewable file in a folder using the toolbar buttons or `ArrowLeft` / `ArrowRight` keys.

### 📖 Rich In-Browser Viewers
- **Markdown Notes Engine**: Renders `.md` lecture notes with a slide-over **Table of Contents (TOC)**, reading-time estimator, heading anchor links, GFM tables, nested task lists, relative image resolution, and syntax-highlighted code blocks.
- **Auto-Rendered Folder `README.md`**: Automatically displays directory-level `README.md` syllabus or lab guides below the file grid.
- **Code & Text Viewer**: GitHub-Dark single-pass syntax highlighter for 30+ file extensions with an unselectable line-number gutter, line-wrap toggle, byte/line stats, and one-click copy.
- **Documents & Slides Viewer**: Embedded preview for `PDF`, `PPT`, `PPTX`, `DOC`, `DOCX`, `XLS`, and `XLSX` with one-click switching between Google Docs Viewer, Microsoft Office Live, and Native Browser PDF rendering.
- **Interactive Media Suite**: Hardware-accelerated image viewer with pointer/touch drag-to-pan and wheel zoom (`20%`–`600%`), plus HTML5 video and audio players for lecture recordings.

### 📱 PWA & Offline Ready
- **Installable Web App**: Full Web App Manifest with maskable icons (`192×192` and `512×512`) for Android, iOS, and desktop installation.
- **Network-First Service Worker**: Keeps the app shell available offline while ensuring newly deployed updates apply immediately.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `/` or `Ctrl + K` / `Cmd + K` | Focus the global file search bar |
| `Escape` | Clear active search, close open modals/TOC, or exit the current file viewer |
| `ArrowLeft` / `ArrowRight` | Open the previous / next viewable file in the current folder |
| `Double-Click` *(Image Viewer)* | Reset image zoom and pan to `100%` |

---

## 🔗 Deep Linking & URL Parameters

Share direct links to any repository, folder, or file using URL query parameters:

| URL Pattern | Description |
| :--- | :--- |
| `?repo=owner/name` | Preloads and saves a GitHub repository into the portal |
| `?repo=gl:owner/name` | Preloads a GitLab repository (`cb:` for Codeberg, `bb:` for Bitbucket) |
| `?repo=owner/name&path=Sem-5/Java` | Opens a specific folder inside a repository |
| `?repo=owner/name&file=Sem-5/Java/Notes.md` | Opens a specific file directly in the appropriate viewer |

---

## 📁 Project Structure

```text
index.html    – App shell, Home Launchpad, sidebar, and viewer containers
style.css     – GitHub-Dark design system, responsive layout, and animations
app.js        – Platform adapters, recursive tree cache, parsers, and router
sw.js         – PWA Service Worker (same-origin network-first caching)
manifest.json – PWA metadata and maskable launcher icons
icons/        – 192x192 and 512x512 PNG application icons
```

## 🛠️ Local Development

Because the portal is built with zero build dependencies, you can run it with any static file server:

```bash
git clone https://github.com/Satya-Siba-Nayak/Git-Notes-Viewer.git
cd Git-Notes-Viewer
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.
