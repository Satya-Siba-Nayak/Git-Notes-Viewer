# 📚 Git Notes Viewer (Study Portal)

## 🌐 Live Demo & Deployment

- **Custom Domain:** [https://git-notes.satya-nayak.dev](https://git-notes.satya-nayak.dev)
- **Cloudflare Pages:** [https://git-notes-viewer.pages.dev/](https://git-notes-viewer.pages.dev/)

---

## ✨ Features

- **⚡ Zero Dependencies:** Pure HTML5, modern CSS3 (CSS variables, flex/grid), and vanilla JS.
- **🔄 Dynamic GitHub API Integration:** Fetches contents in real-time from repository directories using the GitHub Contents API without redeployment.
- **💾 Smart Caching:** Caches directory listings in `sessionStorage` to minimize API calls and prevent unauthenticated rate limiting (60 req/hr).
- **📌 Last Session Memory:** Automatically saves and restores your last-visited directory path from `localStorage`.
- **📄 Document Viewer:**
  - **PDFs:** Seamless rendering via Google Docs Viewer proxy with direct download options.
  - **PowerPoint (.pptx, .ppt):** Embedded via Microsoft Office Web Viewer with Google Docs Viewer fallback.
  - **Subtle Action Bar:** Minimalist toolbar with download, fullscreen, and fallback options.
- **📱 Mobile-Optimized & PWA Ready:**
  - Responsive split-screen desktop layout and collapsible mobile drawer menu.
  - Full PWA support with service worker caching (`sw.js`) and manifest (`manifest.json`) for installability on mobile and desktop.
  - Touch-friendly UI with safe-area insets for modern mobile displays.
- **🔍 Real-Time Filter:** Instant search bar to filter folders and files on the fly.
- **🌙 Modern Dark Mode:** Clean dark theme with smooth transitions and custom file icons.

---

## 🛠️ Project Structure

```text
├── index.html       # Main application markup & PWA meta tags
├── style.css        # Responsive dark theme styling & animations
├── app.js           # GitHub API fetch, tree navigation, viewer & caching logic
├── sw.js            # Service worker for app shell offline caching
├── manifest.json    # PWA configuration manifest
├── icons/           # PWA application icons (192x192, 512x512)
└── README.md        # Documentation and deployment info
```

---

## 🚀 Deployment (Cloudflare Pages)

1. Connect your repository to **Cloudflare Pages**.
2. Set the **Build Command** to empty (none needed).
3. Set the **Build Output Directory** to `/` (root).
4. Deploy!
