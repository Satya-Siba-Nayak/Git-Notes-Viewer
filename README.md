# 📚 Git Notes Viewer

A study resource portal to browse and view files from Git repositories — built with pure HTML, CSS, and JavaScript.

## Live

- [git-notes.satya-nayak.dev](https://git-notes.satya-nayak.dev)
- [git-notes-viewer.pages.dev](https://git-notes-viewer.pages.dev/)

## Features

- Multi-platform Git support (GitHub, GitLab, Codeberg, Gitea, Bitbucket)
- Browse repo folders & files in real-time
- Inline PDF & PowerPoint viewer
- In-browser code & text viewer with syntax highlighting & line numbers
- Deep linking & shareable direct links (`?file=...`, `?repo=...&file=...`)
- Search/filter files, breadcrumb navigation
- Session memory — resumes last visited folder
- Dark mode, fully responsive, mobile drawer
- Installable PWA with offline app shell caching

## Structure

```
index.html    – markup
style.css     – styling
app.js        – logic & Git platform adapters
sw.js         – service worker
manifest.json – PWA config
icons/        – app icons
```
