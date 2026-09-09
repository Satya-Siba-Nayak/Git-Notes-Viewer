/* =========================================================
   TYBCA Study Portal – app.js
   Pure vanilla JS, zero dependencies.
   ========================================================= */

(() => {
  "use strict";

  // ── Config ──────────────────────────────────────────────
  const REPO_OWNER = "Satya-Siba-Nayak";
  const REPO_NAME = "TYBCA";
  const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents`;
  const CACHE_PREFIX = "studyportal_cache_";
  const LAST_PATH_KEY = "studyportal_lastpath";

  // ── DOM refs ────────────────────────────────────────────
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const sidebarClose = document.getElementById("sidebarClose");
  const menuBtn = document.getElementById("menuBtn");
  const searchInput = document.getElementById("searchInput");
  const fileTree = document.getElementById("fileTree");
  const sidebarLoader = document.getElementById("sidebarLoader");
  const breadcrumbs = document.getElementById("breadcrumbs");
  const toolbar = document.getElementById("toolbar");
  const toolbarFilename = document.getElementById("toolbarFilename");
  const backBtn = document.getElementById("backBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const fileGrid = document.getElementById("fileGrid");
  const contentLoader = document.getElementById("contentLoader");
  const viewer = document.getElementById("viewer");
  const viewerLoading = document.getElementById("viewerLoading");
  const viewerFrame = document.getElementById("viewerFrame");
  const viewerFallback = document.getElementById("viewerFallback");
  const fallbackLink = document.getElementById("fallbackLink");
  const fallbackDownload = document.getElementById("fallbackDownload");
  const errorState = document.getElementById("errorState");
  const errorMessage = document.getElementById("errorMessage");
  const retryBtn = document.getElementById("retryBtn");
  const emptyState = document.getElementById("emptyState");

  // ── State ───────────────────────────────────────────────
  let currentPath = "";
  let currentItems = [];
  let currentFile = null; // { name, download_url, html_url, ... }

  // ── Helpers ─────────────────────────────────────────────
  function getIcon(item) {
    if (item.type === "dir") return "📁";
    const ext = (item.name.split(".").pop() || "").toLowerCase();
    if (ext === "pdf") return "📄";
    if (["ppt", "pptx"].includes(ext)) return "📊";
    if (["doc", "docx"].includes(ext)) return "📝";
    if (["xls", "xlsx"].includes(ext)) return "📊";
    if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext)) return "🖼️";
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "📦";
    if (["mp4", "mkv", "avi", "mov"].includes(ext)) return "🎬";
    if (["py", "js", "html", "css", "java", "c", "cpp", "cs"].includes(ext)) return "💻";
    if (["txt", "md", "log"].includes(ext)) return "📝";
    return "📄";
  }

  function formatSize(bytes) {
    if (bytes == null) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function isViewable(name) {
    const ext = (name.split(".").pop() || "").toLowerCase();
    return ["pdf", "ppt", "pptx"].includes(ext);
  }

  function getFileExt(name) {
    return (name.split(".").pop() || "").toLowerCase();
  }

  // ── Sidebar toggle (mobile) ────────────────────────────
  function openSidebar() {
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("open");
  }
  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("open");
  }

  menuBtn.addEventListener("click", openSidebar);
  sidebarClose.addEventListener("click", closeSidebar);
  sidebarOverlay.addEventListener("click", closeSidebar);

  // ── API fetch with caching ─────────────────────────────
  async function fetchContents(path = "") {
    const cacheKey = CACHE_PREFIX + path;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }

    const url = path ? `${API_BASE}/${path}` : API_BASE;
    const res = await fetch(url);

    // Rate-limit check
    const remaining = res.headers.get("X-RateLimit-Remaining");
    if (remaining !== null && parseInt(remaining, 10) <= 5) {
      showRateLimitBanner(remaining);
    }

    if (!res.ok) {
      if (res.status === 403) {
        throw new Error(
          "GitHub API rate limit exceeded. Please wait a minute and try again, or open the repository directly on GitHub."
        );
      }
      throw new Error(`GitHub API returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    // Only cache directory listings (arrays)
    if (Array.isArray(data)) {
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
    }
    return data;
  }

  // ── Rate-limit banner ──────────────────────────────────
  function showRateLimitBanner(remaining) {
    if (document.getElementById("rateBanner")) return;
    const banner = document.createElement("div");
    banner.id = "rateBanner";
    banner.className = "rate-limit-banner";
    banner.innerHTML = `
      <span>⚠️ GitHub API rate limit is low (${remaining} requests remaining). Cached data will be used where possible.</span>
      <button aria-label="Dismiss">✕</button>
    `;
    banner.querySelector("button").addEventListener("click", () => banner.remove());
    document.getElementById("main").prepend(banner);
  }

  // ── Navigate to a directory ────────────────────────────
  async function navigateTo(path) {
    currentPath = path;
    currentFile = null;

    // Persist last visited path for session restore
    try { localStorage.setItem(LAST_PATH_KEY, path); } catch { /* quota */ }

    // Show loading
    hideAll();
    fileGrid.classList.remove("hidden");
    contentLoader.classList.remove("hidden");
    clearFileCards();

    // Update breadcrumbs
    renderBreadcrumbs(path);

    // Hide toolbar/viewer
    toolbar.classList.add("hidden");
    viewer.classList.add("hidden");
    viewerFallback.classList.add("hidden");

    try {
      const items = await fetchContents(path);
      currentItems = Array.isArray(items) ? items : [];
      // Sort: dirs first, then alpha
      currentItems.sort((a, b) => {
        if (a.type === "dir" && b.type !== "dir") return -1;
        if (a.type !== "dir" && b.type === "dir") return 1;
        return a.name.localeCompare(b.name);
      });

      contentLoader.classList.add("hidden");
      renderFileGrid(currentItems);
      renderSidebarTree(currentItems);
    } catch (err) {
      contentLoader.classList.add("hidden");
      showError(err.message);
    }
  }

  // ── Render helpers ─────────────────────────────────────
  function hideAll() {
    fileGrid.classList.add("hidden");
    viewer.classList.add("hidden");
    errorState.classList.add("hidden");
    emptyState.classList.add("hidden");
    viewerFallback.classList.add("hidden");
  }

  function clearFileCards() {
    // Keep the loader, remove cards
    const cards = fileGrid.querySelectorAll(".file-card");
    cards.forEach((c) => c.remove());
  }

  function renderFileGrid(items) {
    clearFileCards();
    fileGrid.classList.remove("hidden");

    if (items.length === 0) {
      fileGrid.classList.add("hidden");
      emptyState.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");

    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "file-card";
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", item.name);

      const meta =
        item.type === "dir" ? "Folder" : formatSize(item.size) || "File";

      card.innerHTML = `
        <span class="file-card-icon">${getIcon(item)}</span>
        <div class="file-card-info">
          <div class="file-card-name">${escapeHtml(item.name)}</div>
          <div class="file-card-meta">${meta}</div>
        </div>
        <span class="file-card-arrow">${item.type === "dir" ? "›" : ""}</span>
      `;

      card.addEventListener("click", () => handleItemClick(item));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleItemClick(item);
        }
      });

      fileGrid.appendChild(card);
    });
  }

  function renderSidebarTree(items) {
    // Clear existing tree items but keep loader
    const existing = fileTree.querySelectorAll(".tree-item");
    existing.forEach((el) => el.remove());
    sidebarLoader.classList.add("hidden");

    // Add a back item if not at root
    if (currentPath) {
      const backItem = document.createElement("button");
      backItem.className = "tree-item";
      backItem.innerHTML = `
        <span class="tree-item-icon">⬆️</span>
        <span class="tree-item-name">.. (go up)</span>
      `;
      backItem.addEventListener("click", () => {
        const parts = currentPath.split("/");
        parts.pop();
        navigateTo(parts.join("/"));
        closeSidebar();
      });
      fileTree.appendChild(backItem);
    }

    items.forEach((item) => {
      const el = document.createElement("button");
      el.className = "tree-item";
      el.dataset.name = item.name.toLowerCase();
      el.innerHTML = `
        <span class="tree-item-icon">${getIcon(item)}</span>
        <span class="tree-item-name">${escapeHtml(item.name)}</span>
        ${item.type === "dir" ? '<span class="tree-item-arrow">›</span>' : ""}
      `;
      el.addEventListener("click", () => {
        handleItemClick(item);
        closeSidebar();
      });
      fileTree.appendChild(el);
    });
  }

  function renderBreadcrumbs(path) {
    breadcrumbs.innerHTML = "";

    const rootCrumb = document.createElement("a");
    rootCrumb.className = "crumb";
    rootCrumb.href = "#";
    rootCrumb.textContent = "🏠 Root";
    rootCrumb.dataset.path = "";
    rootCrumb.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo("");
    });
    breadcrumbs.appendChild(rootCrumb);

    if (!path) {
      rootCrumb.classList.add("active");
      return;
    }

    const parts = path.split("/");
    let accumulated = "";

    parts.forEach((part, i) => {
      accumulated += (i === 0 ? "" : "/") + part;
      const currentAccumulated = accumulated;

      const sep = document.createElement("span");
      sep.className = "crumb-sep";
      sep.textContent = "/";
      breadcrumbs.appendChild(sep);

      const crumb = document.createElement("a");
      crumb.className = "crumb";
      crumb.href = "#";
      crumb.textContent = part;
      crumb.dataset.path = currentAccumulated;

      if (i === parts.length - 1) {
        crumb.classList.add("active");
      }

      crumb.addEventListener("click", (e) => {
        e.preventDefault();
        navigateTo(currentAccumulated);
      });

      breadcrumbs.appendChild(crumb);
    });
  }

  // ── Item click handler ─────────────────────────────────
  function handleItemClick(item) {
    if (item.type === "dir") {
      navigateTo(item.path);
    } else if (isViewable(item.name)) {
      openViewer(item);
    } else if (item.download_url) {
      // Non-viewable: trigger download
      window.open(item.download_url, "_blank");
    }
  }

  // ── Document viewer ────────────────────────────────────
  function openViewer(item) {
    currentFile = item;
    hideAll();

    // Show toolbar
    toolbar.classList.remove("hidden");
    toolbarFilename.textContent = item.name;
    downloadBtn.href = item.download_url || "#";

    // Determine viewer URL
    const ext = getFileExt(item.name);
    const encodedUrl = encodeURIComponent(item.download_url);
    let viewerUrl = "";

    if (ext === "pdf") {
      // Raw GitHub URLs set Content-Disposition: attachment, blocking iframe rendering.
      // Use Google Docs Viewer to proxy and render the PDF.
      viewerUrl = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
    } else if (["ppt", "pptx"].includes(ext)) {
      viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
    }

    // Show loading overlay
    viewerLoading.classList.remove("loaded");

    // Show viewer
    viewer.classList.remove("hidden");
    viewerFrame.src = viewerUrl;

    // Hide loading overlay once iframe loads
    viewerFrame.onload = () => {
      viewerLoading.classList.add("loaded");
    };

    // Show fallback bar for all viewable files
    viewerFallback.classList.remove("hidden");
    if (ext === "pdf") {
      fallbackLink.href = item.download_url;
      fallbackLink.textContent = "Open PDF Directly";
    } else {
      fallbackLink.href = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
      fallbackLink.textContent = "Open in Google Docs Viewer";
    }
    fallbackDownload.href = item.download_url || "#";

    // Close sidebar on mobile
    closeSidebar();
  }

  // ── Back button ────────────────────────────────────────
  backBtn.addEventListener("click", () => {
    if (currentFile) {
      // Go back to current directory listing
      currentFile = null;
      navigateTo(currentPath);
    } else if (currentPath) {
      const parts = currentPath.split("/");
      parts.pop();
      navigateTo(parts.join("/"));
    }
  });

  // ── Fullscreen ─────────────────────────────────────────
  fullscreenBtn.addEventListener("click", () => {
    const el = viewer;
    if (!document.fullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen).call(el);
      fullscreenBtn.textContent = "⛶ Exit Full Screen";
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen).call(
        document
      );
      fullscreenBtn.textContent = "⛶ Full Screen";
    }
  });

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      fullscreenBtn.textContent = "⛶ Full Screen";
    }
  });

  // ── Search / filter ────────────────────────────────────
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase().trim();
    // Filter sidebar tree items
    const treeItems = fileTree.querySelectorAll(".tree-item");
    treeItems.forEach((el) => {
      const name = el.dataset.name;
      if (!name) {
        // ".." item – always show
        el.classList.toggle("hidden", query.length > 0);
        return;
      }
      el.classList.toggle("hidden", !name.includes(query));
    });

    // Filter main grid cards
    if (!currentFile) {
      const filtered = query
        ? currentItems.filter((it) => it.name.toLowerCase().includes(query))
        : currentItems;
      renderFileGrid(filtered);
    }
  });

  // ── Error handling ─────────────────────────────────────
  function showError(msg) {
    hideAll();
    errorState.classList.remove("hidden");
    errorMessage.textContent = msg || "An unexpected error occurred.";
  }

  retryBtn.addEventListener("click", () => {
    // Clear cache for current path and retry
    sessionStorage.removeItem(CACHE_PREFIX + currentPath);
    navigateTo(currentPath);
  });

  // ── Escape HTML ────────────────────────────────────────
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Boot ────────────────────────────────────────────────
  function boot() {
    let startPath = "";
    try {
      const saved = localStorage.getItem(LAST_PATH_KEY);
      if (saved) startPath = saved;
    } catch { /* ignore */ }
    navigateTo(startPath);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // ── PWA Service Worker ──────────────────────────────────
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
})();
