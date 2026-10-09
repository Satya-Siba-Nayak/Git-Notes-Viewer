# 📚 Git Notes Viewer

A fast, lightweight study resource portal to browse and view notes, slides, code, and documents directly from Git repositories — built with vanilla HTML, CSS, and JavaScript.

## 🚀 Live Deployments

- [git-notes.satya-nayak.dev](https://git-notes.satya-nayak.dev)
- [git-notes-viewer.pages.dev](https://git-notes-viewer.pages.dev/)

## ✨ Features

- **Multi-Platform Git Adapters**: Seamless browsing from GitHub, GitLab, Codeberg, Gitea, and Bitbucket.
- **In-Browser Code & Text Viewer**: Dark GitHub theme syntax highlighting, unselectable line number gutter, line wrapping, language badges, and one-click code copy.
- **Markdown Notes Rendering**: Renders lecture notes (`.md`) directly in-portal with typography, tables, and toggle between rendered and raw views.
- **Documents & Slides Viewer**: Preview PDFs, PPT/PPTX slides, Word documents, and Excel spreadsheets inside the website.
- **Image & Media Preview**: Interactive image viewer with zoom/pan controls, plus HTML5 video and audio players for lecture recordings.
- **Deep Linking & Shareable URLs**: Direct links to any file or folder (`?file=...`, `?repo=...&file=...`, `?path=...`) with instant clipboard copy and confirmation toast.
- **Quick Switcher & Recents**: Switch between recently visited repositories with history persistence.
- **Instant Search & Breadcrumbs**: Instant client-side filtering and intuitive breadcrumb navigation.
- **PWA & Offline Ready**: Fast service worker caching and installable app shell.

## 📁 Structure

```
index.html    – App markup & viewer containers
style.css     – Dark theme design system & viewer styles
app.js        – Platform adapters, router, parsers & viewer logic
sw.js         – PWA Service Worker (network-first caching)
manifest.json – PWA web app manifest
icons/        – PWA launcher icons
```
