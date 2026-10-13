/* =========================================================
   TYBCA Study Portal – app.js
   Modern, Pure Vanilla JS, Zero Dependencies
   ========================================================= */

(() => {
  "use strict";

  // ── Multi-Platform Repository Config ────────────────────
  const DEFAULT_REPO = {
    platform: "github",
    host: "github.com",
    owner: "Satya-Siba-Nayak",
    name: "TYBCA",
    branch: "HEAD"
  };

  let currentRepo = { ...DEFAULT_REPO };
  const CACHE_PREFIX = "studyportal_cache_";
  const LAST_PATH_KEY = "studyportal_lastpath";
  const RECENT_REPOS_KEY = "studyportal_recent_repos";
  const STARRED_KEY = "studyportal_starred";

  const PLATFORMS = {
    github: { name: "GitHub", icon: "🐙", host: "github.com" },
    gitlab: { name: "GitLab", icon: "🦊", host: "gitlab.com" },
    codeberg: { name: "Codeberg", icon: "🏔️", host: "codeberg.org" },
    gitea: { name: "Gitea", icon: "☕", host: "gitea.com" },
    bitbucket: { name: "Bitbucket", icon: "🪣", host: "bitbucket.org" }
  };

  function isDefaultRepo(repo = currentRepo) {
    return (
      repo.platform === DEFAULT_REPO.platform &&
      repo.host === DEFAULT_REPO.host &&
      repo.owner === DEFAULT_REPO.owner &&
      repo.name === DEFAULT_REPO.name
    );
  }

  function getRepoString(repo = currentRepo) {
    if (repo.platform === "github" && repo.host === "github.com") {
      return `${repo.owner}/${repo.name}`;
    }
    if (repo.host === "gitlab.com") {
      return `gl:${repo.owner}/${repo.name}`;
    }
    if (repo.host === "codeberg.org") {
      return `cb:${repo.owner}/${repo.name}`;
    }
    if (repo.host === "bitbucket.org") {
      return `bb:${repo.owner}/${repo.name}`;
    }
    return `https://${repo.host}/${repo.owner}/${repo.name}`;
  }

  // ── Platform Adapters ───────────────────────────────────
  const ADAPTERS = {
    github: {
      async fetchContents(repo, path) {
        const encPath = path ? "/" + path.split("/").map(encodeURIComponent).join("/") : "";
        const branchParam = repo.branch && repo.branch !== "HEAD" ? `?ref=${encodeURIComponent(repo.branch)}` : "";
        const url = `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/contents${encPath}${branchParam}`;
        const res = await fetch(url);

        const remaining = res.headers.get("X-RateLimit-Remaining");
        if (remaining !== null && parseInt(remaining, 10) <= 5) {
          showRateLimitBanner(remaining);
        }

        if (!res.ok) {
          if (res.status === 403) {
            throw new Error("GitHub API rate limit exceeded. Please wait a minute or try another repository.");
          }
          if (res.status === 404) {
            throw new Error(`Repository or folder not found on GitHub (${repo.owner}/${repo.name}).`);
          }
          throw new Error(`GitHub returned ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        if (!Array.isArray(data)) return [];
        return data.map((item) => ({
          name: item.name,
          path: item.path,
          type: item.type === "dir" ? "dir" : "file",
          size: item.size,
          download_url: item.download_url
        }));
      }
    },

    gitlab: {
      async fetchContents(repo, path) {
        const host = repo.host || "gitlab.com";
        const projectId = encodeURIComponent(`${repo.owner}/${repo.name}`);
        const params = new URLSearchParams({ per_page: "100" });
        if (path) params.set("path", path);
        if (repo.branch && repo.branch !== "HEAD") params.set("ref", repo.branch);

        const url = `https://${host}/api/v4/projects/${projectId}/repository/tree?${params.toString()}`;
        const res = await fetch(url);

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(`Repository or folder not found on GitLab (${repo.owner}/${repo.name}). Public repos only.`);
          }
          throw new Error(`GitLab returned ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        if (!Array.isArray(data)) return [];
        const branch = repo.branch || "HEAD";
        return data.map((item) => ({
          name: item.name,
          path: item.path,
          type: item.type === "tree" ? "dir" : "file",
          size: null,
          download_url: `https://${host}/${repo.owner}/${repo.name}/-/raw/${branch}/${encodeURIComponent(item.path).replace(/%2F/g, "/")}`
        }));
      }
    },

    codeberg: {
      async fetchContents(repo, path) {
        const host = repo.host || "codeberg.org";
        const encPath = path ? "/" + path.split("/").map(encodeURIComponent).join("/") : "";
        const branchParam = repo.branch && repo.branch !== "HEAD" ? `?ref=${encodeURIComponent(repo.branch)}` : "";
        const url = `https://${host}/api/v1/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/contents${encPath}${branchParam}`;
        const res = await fetch(url);

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(`Repository or folder not found on Codeberg (${repo.owner}/${repo.name}).`);
          }
          throw new Error(`Codeberg returned ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        if (!Array.isArray(data)) return [];
        const branch = repo.branch || "HEAD";
        return data.map((item) => ({
          name: item.name,
          path: item.path,
          type: item.type === "dir" ? "dir" : "file",
          size: item.size,
          download_url: item.download_url || `https://${host}/${repo.owner}/${repo.name}/raw/branch/${branch}/${encodeURIComponent(item.path).replace(/%2F/g, "/")}`
        }));
      }
    },

    gitea: {
      async fetchContents(repo, path) {
        const host = repo.host || "gitea.com";
        const encPath = path ? "/" + path.split("/").map(encodeURIComponent).join("/") : "";
        const branchParam = repo.branch && repo.branch !== "HEAD" ? `?ref=${encodeURIComponent(repo.branch)}` : "";
        const url = `https://${host}/api/v1/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/contents${encPath}${branchParam}`;
        const res = await fetch(url);

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(`Repository or folder not found on Gitea (${repo.owner}/${repo.name}).`);
          }
          throw new Error(`Gitea returned ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        if (!Array.isArray(data)) return [];
        const branch = repo.branch || "HEAD";
        return data.map((item) => ({
          name: item.name,
          path: item.path,
          type: item.type === "dir" ? "dir" : "file",
          size: item.size,
          download_url: item.download_url || `https://${host}/${repo.owner}/${repo.name}/raw/branch/${branch}/${encodeURIComponent(item.path).replace(/%2F/g, "/")}`
        }));
      }
    },

    bitbucket: {
      async fetchContents(repo, path) {
        const branch = repo.branch || "HEAD";
        const encPath = path ? encodeURIComponent(path).replace(/%2F/g, "/") : "";
        const url = `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/src/${branch}/${encPath}?pagelen=100`;
        const res = await fetch(url);

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(`Repository or folder not found on Bitbucket (${repo.owner}/${repo.name}).`);
          }
          throw new Error(`Bitbucket returned ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        const entries = data.values || [];
        return entries.map((item) => ({
          name: item.path.split("/").pop(),
          path: item.path,
          type: item.type === "commit_directory" ? "dir" : "file",
          size: item.size || null,
          download_url: `https://bitbucket.org/${repo.owner}/${repo.name}/raw/${branch}/${encodeURIComponent(item.path).replace(/%2F/g, "/")}`
        }));
      }
    }
  };

  // ── DOM refs ────────────────────────────────────────────
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const sidebarClose = document.getElementById("sidebarClose");
  const menuBtn = document.getElementById("menuBtn");
  const searchInput = document.getElementById("searchInput");
  const searchShortcut = document.getElementById("searchShortcut");
  const fileTree = document.getElementById("fileTree");
  const sidebarLoader = document.getElementById("sidebarLoader");
  const breadcrumbs = document.getElementById("breadcrumbs");
  const toolbar = document.getElementById("toolbar");
  const toolbarFilename = document.getElementById("toolbarFilename");
  const backBtn = document.getElementById("backBtn");
  const prevFileBtn = document.getElementById("prevFileBtn");
  const nextFileBtn = document.getElementById("nextFileBtn");
  const toolbarStarBtn = document.getElementById("toolbarStarBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const shareBtn = document.getElementById("shareBtn");
  const topbarShareBtn = document.getElementById("topbarShareBtn");
  const repoSwitcherBtn = document.getElementById("repoSwitcherBtn");
  const repoSwitcherDropdown = document.getElementById("repoSwitcherDropdown");
  const switcherIcon = document.getElementById("switcherIcon");
  const switcherName = document.getElementById("switcherName");
  const switcherList = document.getElementById("switcherList");
  const switcherCustomBtn = document.getElementById("switcherCustomBtn");
  const pinnedSection = document.getElementById("pinnedSection");
  const pinnedCount = document.getElementById("pinnedCount");
  const pinnedGrid = document.getElementById("pinnedGrid");
  const fileGrid = document.getElementById("fileGrid");
  const contentLoader = document.getElementById("contentLoader");
  const folderReadmeSection = document.getElementById("folderReadmeSection");
  const folderReadmeTitle = document.getElementById("folderReadmeTitle");
  const folderReadmeBody = document.getElementById("folderReadmeBody");
  const viewer = document.getElementById("viewer");
  const viewerLoading = document.getElementById("viewerLoading");
  const viewerFrame = document.getElementById("viewerFrame");
  const codeViewer = document.getElementById("codeViewer");
  const codeLangBadge = document.getElementById("codeLangBadge");
  const codeStats = document.getElementById("codeStats");
  const codeWrapToggle = document.getElementById("codeWrapToggle");
  const copyCodeBtn = document.getElementById("copyCodeBtn");
  const codeScrollArea = document.getElementById("codeScrollArea");
  const codeLines = document.getElementById("codeLines");
  const markdownViewer = document.getElementById("markdownViewer");
  const markdownBody = document.getElementById("markdownBody");
  const mdReadingTime = document.getElementById("mdReadingTime");
  const mdTocToggle = document.getElementById("mdTocToggle");
  const markdownToc = document.getElementById("markdownToc");
  const tocCloseBtn = document.getElementById("tocCloseBtn");
  const tocList = document.getElementById("tocList");
  const mdModeToggle = document.getElementById("mdModeToggle");
  const copyMdBtn = document.getElementById("copyMdBtn");
  const mediaViewer = document.getElementById("mediaViewer");
  const imageViewerContainer = document.getElementById("imageViewerContainer");
  const imageInfo = document.getElementById("imageInfo");
  const zoomInBtn = document.getElementById("zoomInBtn");
  const zoomOutBtn = document.getElementById("zoomOutBtn");
  const zoomResetBtn = document.getElementById("zoomResetBtn");
  const zoomFitBtn = document.getElementById("zoomFitBtn");
  const zoomLevel = document.getElementById("zoomLevel");
  const imageStage = document.getElementById("imageStage");
  const mediaImage = document.getElementById("mediaImage");
  const videoViewerContainer = document.getElementById("videoViewerContainer");
  const mediaVideo = document.getElementById("mediaVideo");
  const audioViewerContainer = document.getElementById("audioViewerContainer");
  const audioTitle = document.getElementById("audioTitle");
  const audioSub = document.getElementById("audioSub");
  const mediaAudio = document.getElementById("mediaAudio");
  const viewerFallback = document.getElementById("viewerFallback");
  const fallbackNotice = document.getElementById("fallbackNotice");
  const fallbackEngineToggle = document.getElementById("fallbackEngineToggle");
  const fallbackLink = document.getElementById("fallbackLink");
  const fallbackDownload = document.getElementById("fallbackDownload");
  const errorState = document.getElementById("errorState");
  const errorMessage = document.getElementById("errorMessage");
  const retryBtn = document.getElementById("retryBtn");
  const emptyState = document.getElementById("emptyState");
  const logo = document.getElementById("logo");
  const repoBadge = document.getElementById("repoBadge");
  const toast = document.getElementById("toast");
  const devOverlay = document.getElementById("devOverlay");
  const devRepoInput = document.getElementById("devRepoInput");
  const devPlatformsGuide = document.getElementById("devPlatformsGuide");
  const devRecentSection = document.getElementById("devRecentSection");
  const devRecentList = document.getElementById("devRecentList");
  const devCancel = document.getElementById("devCancel");
  const devApply = document.getElementById("devApply");
  const devReset = document.getElementById("devReset");
  const devClose = document.getElementById("devClose");

  // ── State ───────────────────────────────────────────────
  let currentPath = "";
  let currentItems = [];
  let currentFile = null;
  let currentRawText = "";
  let currentBaseRawUrl = "";
  let repoTreeCache = {}; // Keyed by platform_host_owner_name_branch
  let inFlightTrees = {}; // Prevents duplicate parallel requests on boot
  let currentDocEngine = "google"; // "google" | "office" | "native"
  let isCodeWrapped = false;
  let isMarkdownRaw = false;

  // Zoom & Pan state for image preview
  let zoomScale = 1;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let startPanX = 0;
  let startPanY = 0;

  // ── Extension & Language Classification ─────────────────
  const CODE_EXT_MAP = {
    js: "JavaScript", mjs: "JavaScript", cjs: "JavaScript", jsx: "React JSX",
    ts: "TypeScript", tsx: "React TSX",
    py: "Python", pyw: "Python",
    java: "Java",
    c: "C", h: "C Header", cpp: "C++", cc: "C++", cxx: "C++", hpp: "C++ Header",
    cs: "C#",
    go: "Go",
    rs: "Rust",
    php: "PHP",
    rb: "Ruby",
    sql: "SQL",
    html: "HTML", htm: "HTML",
    css: "CSS", scss: "SCSS", sass: "Sass", less: "Less",
    json: "JSON",
    xml: "XML", svg: "SVG",
    yaml: "YAML", yml: "YAML",
    toml: "TOML", ini: "INI", env: "ENV",
    txt: "Plain Text", log: "Log", csv: "CSV",
    sh: "Shell", bash: "Bash", zsh: "Zsh", bat: "Batch", ps1: "PowerShell",
    dockerfile: "Dockerfile", makefile: "Makefile"
  };

  const DOC_EXTS = ["pdf", "ppt", "pptx", "doc", "docx", "xls", "xlsx"];
  const MD_EXTS = ["md", "markdown"];
  const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"];
  const VIDEO_EXTS = ["mp4", "webm", "ogg", "mov", "mkv"];
  const AUDIO_EXTS = ["mp3", "wav", "ogg", "m4a", "aac", "flac"];

  // ── Helpers ─────────────────────────────────────────────
  function getFileExt(name) {
    return (name.split(".").pop() || "").toLowerCase();
  }

  function isCodeOrText(name) {
    const ext = getFileExt(name);
    if (ext in CODE_EXT_MAP) return true;
    const lower = name.toLowerCase();
    return ["dockerfile", "makefile", "license", "notice", ".env"].includes(lower);
  }

  function isMarkdown(name) {
    return MD_EXTS.includes(getFileExt(name));
  }

  function isImage(name) {
    return IMAGE_EXTS.includes(getFileExt(name));
  }

  function isVideo(name) {
    return VIDEO_EXTS.includes(getFileExt(name));
  }

  function isAudio(name) {
    return AUDIO_EXTS.includes(getFileExt(name));
  }

  function isDocument(name) {
    return DOC_EXTS.includes(getFileExt(name));
  }

  function isViewable(name) {
    return isDocument(name) || isMarkdown(name) || isCodeOrText(name) || isImage(name) || isVideo(name) || isAudio(name);
  }

  function getIcon(item) {
    if (item.type === "dir") return "📁";
    const ext = getFileExt(item.name);
    if (ext === "pdf") return "📄";
    if (["ppt", "pptx"].includes(ext)) return "📊";
    if (["doc", "docx"].includes(ext)) return "📝";
    if (["xls", "xlsx"].includes(ext)) return "📈";
    if (IMAGE_EXTS.includes(ext)) return "🖼️";
    if (VIDEO_EXTS.includes(ext)) return "🎬";
    if (AUDIO_EXTS.includes(ext)) return "🎵";
    if (MD_EXTS.includes(ext)) return "📖";
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "📦";
    if (["py", "js", "ts", "html", "css", "java", "c", "cpp", "cs", "sql", "sh", "rs", "go"].includes(ext)) return "💻";
    if (["txt", "log", "json", "yaml", "yml"].includes(ext)) return "📄";
    return "📄";
  }

  function formatSize(bytes) {
    if (bytes == null) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  // ── XSS Sanitization & HTML Escaping ─────────────────────
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeUrl(url) {
    const trimmed = (url || "").trim();
    if (/^(javascript|vbscript|data):/i.test(trimmed)) return "#";
    return trimmed;
  }

  function getBaseRawUrl(fileUrl) {
    if (!fileUrl) return "";
    const lastSlash = fileUrl.lastIndexOf("/");
    if (lastSlash === -1) return "";
    return fileUrl.substring(0, lastSlash + 1);
  }

  // ── Clipboard with Robust Fallback ──────────────────────
  async function copyToClipboard(text) {
    let success = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch {
        success = false;
      }
    }
    if (!success) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.top = "-9999px";
        ta.style.left = "-9999px";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        success = document.execCommand("copy");
        ta.remove();
      } catch {
        success = false;
      }
    }
    return success;
  }

  // ── Toast Pill (Android-style) ─────────────────────────
  let toastTimeout = null;
  function showToast(msg, duration = 2200) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove("hidden");
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.add("hidden");
    }, duration);
  }

  // ── Pinned / Starred Resources ─────────────────────────
  function getStarredFiles() {
    try {
      const data = localStorage.getItem(STARRED_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function isStarred(item) {
    if (!item || !item.path) return false;
    const list = getStarredFiles();
    const repoKey = getRepoString(currentRepo);
    return list.some((f) => f.repoKey === repoKey && f.path === item.path);
  }

  function toggleStar(item) {
    if (!item || !item.path) return false;
    const list = getStarredFiles();
    const repoKey = getRepoString(currentRepo);
    const idx = list.findIndex((f) => f.repoKey === repoKey && f.path === item.path);
    let nowStarred = false;

    if (idx !== -1) {
      list.splice(idx, 1);
      nowStarred = false;
      showToast("Removed from pinned resources");
    } else {
      list.unshift({
        repoKey,
        path: item.path,
        name: item.name,
        type: item.type || "file",
        size: item.size || null,
        download_url: item.download_url
      });
      nowStarred = true;
      showToast("⭐ Pinned to resources!");
    }

    try {
      localStorage.setItem(STARRED_KEY, JSON.stringify(list.slice(0, 20)));
    } catch {}

    updateStarredUI();
    return nowStarred;
  }

  function updateStarredUI() {
    if (toolbarStarBtn && currentFile) {
      const starred = isStarred(currentFile);
      toolbarStarBtn.classList.toggle("starred", starred);
      toolbarStarBtn.textContent = starred ? "⭐ Pinned" : "☆ Pin";
    }

    document.querySelectorAll(".card-star-btn").forEach((btn) => {
      const p = btn.dataset.path;
      const starred = isStarred({ path: p });
      btn.classList.toggle("starred", starred);
      btn.textContent = starred ? "⭐" : "☆";
    });

    renderPinnedSection();
  }

  function renderPinnedSection() {
    if (!pinnedSection || !pinnedGrid) return;
    if (currentFile || currentPath !== "") {
      pinnedSection.classList.add("hidden");
      return;
    }

    const list = getStarredFiles();
    const repoKey = getRepoString(currentRepo);
    const repoStarred = list.filter((f) => f.repoKey === repoKey);

    if (repoStarred.length === 0) {
      pinnedSection.classList.add("hidden");
      return;
    }

    pinnedSection.classList.remove("hidden");
    if (pinnedCount) pinnedCount.textContent = `${repoStarred.length} pinned`;
    pinnedGrid.innerHTML = "";

    repoStarred.forEach((item) => {
      const card = document.createElement("div");
      card.className = "pinned-card";
      const folder = item.path.includes("/") ? item.path.substring(0, item.path.lastIndexOf("/")) : "Root";

      card.innerHTML = `
        <div class="pinned-card-main">
          <span class="pinned-card-icon">${getIcon(item)}</span>
          <div class="pinned-card-info">
            <span class="pinned-card-name">${escapeHtml(item.name)}</span>
            <span class="pinned-card-path">📁 ${escapeHtml(folder)}</span>
          </div>
        </div>
        <button type="button" class="pinned-remove-btn" title="Unpin file">✕</button>
      `;

      card.querySelector(".pinned-card-main").addEventListener("click", () => {
        openViewer(item);
      });

      card.querySelector(".pinned-remove-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        toggleStar(item);
      });

      pinnedGrid.appendChild(card);
    });
  }

  // ── Recent Repositories Management ─────────────────────
  function getRecentRepos() {
    try {
      const data = localStorage.getItem(RECENT_REPOS_KEY);
      if (!data) return [];
      const list = JSON.parse(data);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function saveRecentRepo(repo) {
    if (!repo || !repo.owner || !repo.name) return;
    try {
      const list = getRecentRepos().filter(
        (r) => !(r.host === repo.host && r.owner.toLowerCase() === repo.owner.toLowerCase() && r.name.toLowerCase() === repo.name.toLowerCase())
      );
      list.unshift({
        platform: repo.platform || "github",
        host: repo.host || "github.com",
        owner: repo.owner,
        name: repo.name,
        branch: repo.branch || "HEAD",
        timestamp: Date.now()
      });
      const trimmed = list.slice(0, 8);
      localStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(trimmed));
      renderRecentReposList();
    } catch { /* storage quota */ }
  }

  function removeRecentRepo(host, owner, name) {
    try {
      const list = getRecentRepos().filter(
        (r) => !(r.host === host && r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === name.toLowerCase())
      );
      localStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(list));
      renderRecentReposList();
    } catch { /* storage */ }
  }

  function renderRecentReposList() {
    const list = getRecentRepos();

    // 1. Topbar Quick Switcher Dropdown
    if (switcherList) {
      switcherList.innerHTML = "";

      const defItem = document.createElement("div");
      defItem.className = `switcher-item ${isDefaultRepo() ? "active" : ""}`;
      defItem.innerHTML = `
        <div class="switcher-item-main">
          <span class="switcher-item-icon">🐙</span>
          <div class="switcher-item-info">
            <span class="switcher-item-name">TYBCA</span>
            <span class="switcher-item-sub">Default Portal</span>
          </div>
        </div>
      `;
      defItem.addEventListener("click", () => {
        closeRepoSwitcher();
        if (!isDefaultRepo()) resetToDefaultRepo();
      });
      switcherList.appendChild(defItem);

      list.forEach((repo) => {
        if (isDefaultRepo(repo)) return;
        const platInfo = PLATFORMS[repo.platform] || { icon: "📁", name: "Git" };
        const isActive = !isDefaultRepo() && currentRepo.host === repo.host && currentRepo.owner === repo.owner && currentRepo.name === repo.name;

        const item = document.createElement("div");
        item.className = `switcher-item ${isActive ? "active" : ""}`;
        item.innerHTML = `
          <div class="switcher-item-main">
            <span class="switcher-item-icon">${platInfo.icon}</span>
            <div class="switcher-item-info">
              <span class="switcher-item-name">${escapeHtml(repo.name)}</span>
              <span class="switcher-item-sub">${escapeHtml(repo.owner)}</span>
            </div>
          </div>
          <button type="button" class="switcher-item-remove" title="Remove from list">✕</button>
        `;

        item.querySelector(".switcher-item-main").addEventListener("click", () => {
          closeRepoSwitcher();
          loadCustomRepo(repo);
        });

        item.querySelector(".switcher-item-remove").addEventListener("click", (e) => {
          e.stopPropagation();
          removeRecentRepo(repo.host, repo.owner, repo.name);
        });

        switcherList.appendChild(item);
      });
    }

    // 2. Developer Modal Recent Section
    if (devRecentSection && devRecentList) {
      if (list.length === 0) {
        devRecentSection.classList.add("hidden");
      } else {
        devRecentSection.classList.remove("hidden");
        devRecentList.innerHTML = "";
        list.forEach((repo) => {
          const platInfo = PLATFORMS[repo.platform] || { icon: "📁" };
          const row = document.createElement("div");
          row.className = "dev-recent-item";
          row.innerHTML = `
            <span>${platInfo.icon} <strong>${escapeHtml(repo.owner)}/${escapeHtml(repo.name)}</strong></span>
            <span style="font-size: 0.72rem; color: var(--text-muted);">${repo.host}</span>
          `;
          row.addEventListener("click", () => {
            closeDevModal();
            loadCustomRepo(repo);
          });
          devRecentList.appendChild(row);
        });
      }
    }
  }

  // ── Update Repo UI Elements ─────────────────────────────
  function updateRepoUI() {
    const isDef = isDefaultRepo();
    const platInfo = PLATFORMS[currentRepo.platform] || { icon: "📁", name: "Git" };

    document.title = isDef ? "Study Portal" : `${currentRepo.name} – Study Portal`;

    if (repoBadge) {
      if (isDef) {
        repoBadge.classList.add("hidden");
      } else {
        repoBadge.classList.remove("hidden");
        repoBadge.innerHTML = `<span>${platInfo.icon}</span> <span>${escapeHtml(currentRepo.owner)}/${escapeHtml(currentRepo.name)}</span>`;
      }
    }

    if (switcherIcon) switcherIcon.textContent = platInfo.icon;
    if (switcherName) switcherName.textContent = isDef ? "TYBCA" : currentRepo.name;

    renderRecentReposList();
  }

  // ── Quick Switcher Dropdown Toggle ──────────────────────
  function openRepoSwitcher() {
    if (!repoSwitcherDropdown) return;
    renderRecentReposList();
    repoSwitcherDropdown.classList.remove("hidden");
    repoSwitcherBtn.setAttribute("aria-expanded", "true");
  }

  function closeRepoSwitcher() {
    if (!repoSwitcherDropdown) return;
    repoSwitcherDropdown.classList.add("hidden");
    repoSwitcherBtn.setAttribute("aria-expanded", "false");
  }

  if (repoSwitcherBtn) {
    repoSwitcherBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (repoSwitcherDropdown.classList.contains("hidden")) {
        openRepoSwitcher();
      } else {
        closeRepoSwitcher();
      }
    });
  }

  if (switcherCustomBtn) {
    switcherCustomBtn.addEventListener("click", () => {
      closeRepoSwitcher();
      openDevModal();
    });
  }

  document.addEventListener("click", (e) => {
    if (repoSwitcherDropdown && !repoSwitcherDropdown.contains(e.target) && !repoSwitcherBtn.contains(e.target)) {
      closeRepoSwitcher();
    }
  });

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

  // ── Multi-Platform Recursive Tree API (1 Request for entire repo) ──
  async function fetchRepoTree(repo) {
    const branch = repo.branch || "HEAD";
    const treeKey = `${repo.platform}_${repo.host}_${repo.owner}_${repo.name}_${branch}`;

    if (repoTreeCache[treeKey]) return repoTreeCache[treeKey];
    if (inFlightTrees[treeKey]) return inFlightTrees[treeKey];

    const cacheKey = `studyportal_tree_${treeKey}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          repoTreeCache[treeKey] = parsed;
          return parsed;
        }
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }

    inFlightTrees[treeKey] = (async () => {
      try {
        // 1. GitHub, Codeberg & Gitea (Git Trees API)
        if (["github", "codeberg", "gitea"].includes(repo.platform)) {
          const apiBase =
            repo.platform === "github"
              ? "https://api.github.com/repos"
              : `https://${repo.host}/api/v1/repos`;

          const url = `${apiBase}/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
          const res = await fetch(url);

          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.tree) && !data.truncated) {
              const items = data.tree
                .filter((it) => !it.path.split("/").some((seg) => seg.startsWith(".")))
                .map((it) => {
                  const parts = it.path.split("/");
                  const name = parts[parts.length - 1];
                  const isDir = it.type === "tree";
                  const safePath = parts.map(encodeURIComponent).join("/");
                  const rawUrl =
                    repo.platform === "github"
                      ? `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${branch}/${safePath}`
                      : `https://${repo.host}/${repo.owner}/${repo.name}/raw/branch/${branch}/${safePath}`;

                  return {
                    name,
                    path: it.path,
                    type: isDir ? "dir" : "file",
                    size: it.size ?? null,
                    download_url: isDir ? null : rawUrl
                  };
                });

              repoTreeCache[treeKey] = items;
              try { sessionStorage.setItem(cacheKey, JSON.stringify(items)); } catch {}
              return items;
            }
          }
        }

        // 2. GitLab Recursive Tree
        if (repo.platform === "gitlab") {
          const host = repo.host || "gitlab.com";
          const projectId = encodeURIComponent(`${repo.owner}/${repo.name}`);
          const params = new URLSearchParams({ recursive: "true", per_page: "100" });
          if (branch !== "HEAD") params.set("ref", branch);

          const res = await fetch(`https://${host}/api/v4/projects/${projectId}/repository/tree?${params}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length < 100) {
              const items = data
                .filter((it) => !it.path.split("/").some((seg) => seg.startsWith(".")))
                .map((it) => {
                  const safePath = it.path.split("/").map(encodeURIComponent).join("/");
                  return {
                    name: it.name,
                    path: it.path,
                    type: it.type === "tree" ? "dir" : "file",
                    size: null,
                    download_url:
                      it.type === "tree"
                        ? null
                        : `https://${host}/${repo.owner}/${repo.name}/-/raw/${branch}/${safePath}`
                  };
                });

              repoTreeCache[treeKey] = items;
              try { sessionStorage.setItem(cacheKey, JSON.stringify(items)); } catch {}
              return items;
            }
          }
        }
      } catch {
        // Fall back silently to per-folder adapter
      } finally {
        delete inFlightTrees[treeKey];
      }
      return null;
    })();

    return inFlightTrees[treeKey];
  }

  // ── API fetch with caching & tree fallback ──────────────
  async function fetchContents(path = "") {
    const branch = currentRepo.branch || "HEAD";
    const treeKey = `${currentRepo.platform}_${currentRepo.host}_${currentRepo.owner}_${currentRepo.name}_${branch}`;
    let tree = repoTreeCache[treeKey];
    if (!tree) {
      tree = await fetchRepoTree(currentRepo);
    }

    if (tree && Array.isArray(tree)) {
      if (!path) {
        return tree.filter((it) => !it.path.includes("/"));
      }
      const prefix = path + "/";
      return tree.filter((it) => it.path.startsWith(prefix) && !it.path.slice(prefix.length).includes("/"));
    }

    const cacheKey = `${CACHE_PREFIX}${currentRepo.platform}_${currentRepo.host}_${currentRepo.owner}_${currentRepo.name}_${path}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }

    const adapter = ADAPTERS[currentRepo.platform] || ADAPTERS.github;
    const items = await adapter.fetchContents(currentRepo, path);

    const cleaned = (items || []).filter((item) => !item.name.startsWith("."));

    if (Array.isArray(cleaned)) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(cleaned));
      } catch { /* storage quota */ }
    }
    return cleaned;
  }

  // ── Rate-limit banner ──────────────────────────────────
  function showRateLimitBanner(remaining) {
    if (document.getElementById("rateBanner")) return;
    const banner = document.createElement("div");
    banner.id = "rateBanner";
    banner.className = "rate-limit-banner";
    banner.innerHTML = `
      <span>⚠️ API rate limit is low (${remaining} requests remaining). Cached data will be used where possible.</span>
      <button type="button" aria-label="Dismiss">✕</button>
    `;
    banner.querySelector("button").addEventListener("click", () => banner.remove());
    document.getElementById("main").prepend(banner);
  }

  // ── URL & Deep Linking ──────────────────────────────────
  function updateUrl({ path, file } = {}, replace = false) {
    const url = new URL(window.location.origin + window.location.pathname);

    if (!isDefaultRepo()) {
      url.searchParams.set("repo", getRepoString(currentRepo));
    }

    if (file) {
      url.searchParams.set("file", file);
    } else if (path) {
      url.searchParams.set("path", path);
    }

    const newQuery = url.search ? url.search : window.location.pathname;
    if (replace) {
      history.replaceState({ repo: currentRepo, path, file }, "", newQuery);
    } else {
      if (window.location.search !== (url.search || "")) {
        history.pushState({ repo: currentRepo, path, file }, "", newQuery);
      }
    }
  }

  // ── Navigate to a directory ────────────────────────────
  async function navigateTo(path, updateHistory = true) {
    currentPath = path;
    currentFile = null;

    if (updateHistory) {
      updateUrl({ path });
    }

    if (isDefaultRepo()) {
      try { localStorage.setItem(LAST_PATH_KEY, path); } catch { /* quota */ }
    }

    hideAll();
    fileGrid.classList.remove("hidden");
    contentLoader.classList.remove("hidden");
    clearFileCards();

    renderBreadcrumbs(path);

    toolbar.classList.add("hidden");
    viewer.classList.add("hidden");
    codeViewer.classList.add("hidden");
    markdownViewer.classList.add("hidden");
    mediaViewer.classList.add("hidden");
    viewerFallback.classList.add("hidden");

    try {
      const items = await fetchContents(path);
      currentItems = Array.isArray(items) ? items : [];
      currentItems.sort((a, b) => {
        if (a.type === "dir" && b.type !== "dir") return -1;
        if (a.type !== "dir" && b.type === "dir") return 1;
        return a.name.localeCompare(b.name);
      });

      contentLoader.classList.add("hidden");
      renderPinnedSection();
      renderFileGrid(currentItems);
      renderSidebarTree(currentItems);
    } catch (err) {
      contentLoader.classList.add("hidden");
      showError(err.message);
    }
  }

  // ── Render helpers & Media Teardown ────────────────────
  function hideAll() {
    if (mediaVideo) {
      try {
        mediaVideo.pause?.();
        mediaVideo.removeAttribute("src");
        mediaVideo.load?.();
      } catch {}
    }
    if (mediaAudio) {
      try {
        mediaAudio.pause?.();
        mediaAudio.removeAttribute("src");
        mediaAudio.load?.();
      } catch {}
    }
    if (viewerFrame) {
      viewerFrame.src = "about:blank";
      viewerFrame.classList.add("hidden");
    }

    if (pinnedSection) pinnedSection.classList.add("hidden");
    if (folderReadmeSection) folderReadmeSection.classList.add("hidden");
    if (markdownToc) markdownToc.classList.add("hidden");
    if (mdTocToggle) mdTocToggle.classList.add("hidden");

    fileGrid.classList.add("hidden");
    viewer.classList.add("hidden");
    codeViewer.classList.add("hidden");
    markdownViewer.classList.add("hidden");
    mediaViewer.classList.add("hidden");
    errorState.classList.add("hidden");
    emptyState.classList.add("hidden");
    viewerFallback.classList.add("hidden");
  }

  function clearFileCards() {
    const cards = fileGrid.querySelectorAll(".file-card");
    cards.forEach((c) => c.remove());
  }

  function renderFileGrid(items, isSearchResult = false) {
    clearFileCards();
    fileGrid.classList.remove("hidden");

    if (items.length === 0) {
      fileGrid.classList.add("hidden");
      emptyState.classList.remove("hidden");
      if (folderReadmeSection) folderReadmeSection.classList.add("hidden");
      return;
    }

    emptyState.classList.add("hidden");

    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "file-card";
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", item.name);

      let meta = item.type === "dir" ? "Folder" : formatSize(item.size) || "File";
      if (isSearchResult && item.path.includes("/")) {
        const folder = item.path.substring(0, item.path.lastIndexOf("/"));
        meta = `<span class="search-path-badge">${escapeHtml(folder)}</span> ${meta}`;
      }

      const isFile = item.type !== "dir";
      const starred = isStarred(item);

      card.innerHTML = `
        <span class="file-card-icon">${getIcon(item)}</span>
        <div class="file-card-info">
          <div class="file-card-name">${escapeHtml(item.name)}</div>
          <div class="file-card-meta">${meta}</div>
        </div>
        ${isFile ? `<button type="button" class="card-star-btn ${starred ? "starred" : ""}" data-path="${escapeHtml(item.path)}" title="Pin / star file">${starred ? "⭐" : "☆"}</button>` : ""}
        <span class="file-card-arrow">${item.type === "dir" ? "›" : ""}</span>
      `;

      card.addEventListener("click", () => {
        if (isSearchResult) {
          searchInput.value = "";
        }
        handleItemClick(item);
      });

      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (isSearchResult) {
            searchInput.value = "";
          }
          handleItemClick(item);
        }
      });

      const starBtn = card.querySelector(".card-star-btn");
      if (starBtn) {
        starBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleStar(item);
        });
      }

      fileGrid.appendChild(card);
    });

    // Auto-render folder README.md if present (not during search)
    if (!isSearchResult && !currentFile && folderReadmeSection && folderReadmeBody) {
      const readmeItem = items.find((i) => i.type !== "dir" && i.name.toLowerCase() === "readme.md");
      if (readmeItem && readmeItem.download_url) {
        folderReadmeSection.classList.remove("hidden");
        if (folderReadmeTitle) folderReadmeTitle.textContent = readmeItem.name;
        folderReadmeBody.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><span>Loading README…</span></div>';
        fetch(readmeItem.download_url)
          .then((r) => r.text())
          .then((text) => {
            const baseRawUrl = getBaseRawUrl(readmeItem.download_url);
            const parsed = parseMarkdown(text, baseRawUrl);
            folderReadmeBody.innerHTML = parsed.html;
          })
          .catch(() => {
            folderReadmeSection.classList.add("hidden");
          });
      } else {
        folderReadmeSection.classList.add("hidden");
        folderReadmeBody.innerHTML = "";
      }
    } else if (folderReadmeSection) {
      folderReadmeSection.classList.add("hidden");
    }
  }

  function renderSidebarTree(items) {
    const existing = fileTree.querySelectorAll(".tree-item");
    existing.forEach((el) => el.remove());
    sidebarLoader.classList.add("hidden");

    if (currentPath) {
      const backItem = document.createElement("button");
      backItem.type = "button";
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
      el.type = "button";
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
    const platIcon = PLATFORMS[currentRepo.platform]?.icon || "";
    rootCrumb.textContent = isDefaultRepo() ? "🏠 Root" : `🏠 ${platIcon} ${currentRepo.name}`;
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
      window.open(item.download_url, "_blank");
    }
  }

  // ── Syntax Highlighter (Single-Pass Tokenizer) ─────────
  function highlightSyntax(lineText, ext) {
    if (!lineText) return "&nbsp;";
    const e = (ext || "").toLowerCase();
    const escaped = escapeHtml(lineText);

    const tokenRegex = /(&quot;(?:\\&quot;|[^&]|&(?!quot;))*?&quot;|&#39;(?:\\&#39;|[^&]|&(?!#39;))*?&#39;|`[\s\S]*?`)|(\/\/.*$|#.*$|--.*$|&lt;!--.*$)|(&lt;\/?[a-zA-Z0-9\-]+)(?=&gt;|\s)|(\b(?:true|false|True|False|null|undefined|None|nil)\b)|(\b(?:function|def|class|import|from|export|default|return|if|else|elif|for|while|do|switch|case|break|continue|try|catch|except|finally|throw|raise|async|await|new|this|self|const|let|var|public|private|protected|static|void|int|float|double|boolean|bool|string|char|struct|enum|interface|type|package|namespace|using|fn|mut|SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|JOIN|LEFT|RIGHT|INNER|GROUP|BY|ORDER|HAVING|LIMIT|CREATE|TABLE|DATABASE|DROP|ALTER|AS|AND|OR|NOT|IN|IS|NULL)\b)|(\b\d+(?:\.\d+)?\b)/g;

    return escaped.replace(tokenRegex, (match, str, comment, tag, bool, kw, num) => {
      if (str) return `<span class="syn-string">${str}</span>`;
      if (comment) {
        const isSlash = comment.startsWith("//") && ["js", "ts", "jsx", "tsx", "java", "c", "cpp", "h", "hpp", "cs", "go", "rs", "php", "css"].includes(e);
        const isHash = comment.startsWith("#") && ["py", "sh", "bash", "zsh", "yaml", "yml", "toml", "ini", "dockerfile", "makefile", "rb", "env"].includes(e);
        const isSql = comment.startsWith("--") && e === "sql";
        const isHtml = comment.startsWith("&lt;!--") && ["html", "xml", "svg"].includes(e);
        if (isSlash || isHash || isSql || isHtml) return `<span class="syn-comment">${comment}</span>`;
        return match;
      }
      if (tag && ["html", "xml", "svg", "jsx", "tsx"].includes(e)) return `<span class="syn-tag">${tag}</span>`;
      if (bool) return `<span class="syn-bool">${bool}</span>`;
      if (kw) return `<span class="syn-keyword">${kw}</span>`;
      if (num) return `<span class="syn-number">${num}</span>`;
      return match;
    });
  }

  // ── Zero-dependency Markdown Parser (XSS-safe, code-highlighted & TOC) ─
  function isTableDelimiter(line) {
    const t = (line || "").trim();
    return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(t);
  }

  function parseTableLine(line) {
    let t = line.trim();
    if (t.startsWith("|")) t = t.slice(1);
    if (t.endsWith("|")) t = t.slice(0, -1);
    return t.split("|").map((c) => c.trim());
  }

  function parseMarkdown(md, baseRawUrl = "") {
    if (!md) return { html: "", headings: [] };

    const lines = md.split(/\r\n|\r|\n/);
    const htmlParts = [];
    const headings = [];
    let inCodeBlock = false;
    let codeBlockLang = "";
    let codeBlockContent = [];
    let listStack = [];
    let inTable = false;
    let tableRows = [];

    function closeListsUpTo(indent) {
      while (listStack.length > 0 && listStack[listStack.length - 1].indent > indent) {
        const top = listStack.pop();
        htmlParts.push(`</${top.type}>`);
      }
    }

    function flushAllLists() {
      while (listStack.length > 0) {
        const top = listStack.pop();
        htmlParts.push(`</${top.type}>`);
      }
    }

    function flushTable() {
      if (inTable && tableRows.length > 0) {
        let tableHtml = "<table>";
        const headerCells = tableRows[0];
        tableHtml += "<thead><tr>" + headerCells.map((c) => `<th>${formatInline(c)}</th>`).join("") + "</tr></thead><tbody>";
        for (let r = 1; r < tableRows.length; r++) {
          tableHtml += "<tr>" + tableRows[r].map((c) => `<td>${formatInline(c)}</td>`).join("") + "</tr>";
        }
        tableHtml += "</tbody></table>";
        htmlParts.push(tableHtml);
        inTable = false;
        tableRows = [];
      }
    }

    function formatInline(text) {
      let t = escapeHtml(text);
      t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
      t = t.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
      t = t.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      t = t.replace(/\*(.*?)\*/g, "<em>$1</em>");
      t = t.replace(/~~(.*?)~~/g, "<del>$1</del>");
      // Images: ![alt](url)
      t = t.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
        let fullSrc = src.trim();
        if (baseRawUrl && !/^https?:\/\//i.test(fullSrc)) {
          fullSrc = baseRawUrl + fullSrc.replace(/^\.?\//, "");
        }
        return `<img src="${sanitizeUrl(fullSrc)}" alt="${alt}" loading="lazy" class="md-img" />`;
      });
      // Links: [text](url)
      t = t.replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
        return `<a href="${sanitizeUrl(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      });
      return t;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code blocks with syntax highlighting
      if (line.trim().startsWith("```")) {
        if (!inCodeBlock) {
          flushAllLists();
          flushTable();
          inCodeBlock = true;
          codeBlockLang = line.trim().slice(3).trim();
          codeBlockContent = [];
        } else {
          inCodeBlock = false;
          const highlighted = codeBlockContent
            .map((codeLine) => highlightSyntax(codeLine, codeBlockLang))
            .join("\n");
          htmlParts.push(`<pre><code class="lang-${escapeHtml(codeBlockLang)}">${highlighted}</code></pre>`);
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      const trimmed = line.trim();

      if (!trimmed) {
        flushTable();
        continue;
      }

      // Horizontal Rule
      if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        flushAllLists();
        flushTable();
        htmlParts.push("<hr />");
        continue;
      }

      // Headers with anchor IDs
      const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headerMatch) {
        flushAllLists();
        flushTable();
        const level = headerMatch[1].length;
        const rawHeaderText = headerMatch[2].trim();
        const slug = rawHeaderText.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || `heading-${i}`;
        headings.push({ level, text: rawHeaderText, slug });
        htmlParts.push(`<h${level} id="${slug}"><a class="header-anchor" href="#${slug}" title="Direct link">#</a>${formatInline(rawHeaderText)}</h${level}>`);
        continue;
      }

      // Blockquote
      if (trimmed.startsWith(">")) {
        flushAllLists();
        flushTable();
        const quoteText = trimmed.replace(/^>\s?/, "");
        htmlParts.push(`<blockquote>${formatInline(quoteText)}</blockquote>`);
        continue;
      }

      // Tables
      if (trimmed.includes("|")) {
        if (!inTable) {
          const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : "";
          if (isTableDelimiter(nextLine)) {
            flushAllLists();
            inTable = true;
            tableRows.push(parseTableLine(trimmed));
            continue;
          }
        } else {
          if (isTableDelimiter(trimmed)) {
            continue;
          }
          tableRows.push(parseTableLine(trimmed));
          continue;
        }
      } else if (inTable) {
        flushTable();
      }

      // Lists
      const ulMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
      const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
      if (ulMatch || olMatch) {
        flushTable();
        const isUl = !!ulMatch;
        const type = isUl ? "ul" : "ol";
        const indent = (ulMatch || olMatch)[1].length;
        let content = (ulMatch || olMatch)[2];

        if (content.startsWith("[ ] ")) {
          content = '<input type="checkbox" disabled /> ' + content.slice(4);
        } else if (content.startsWith("[x] ") || content.startsWith("[X] ")) {
          content = '<input type="checkbox" checked disabled /> ' + content.slice(4);
        }

        if (listStack.length === 0) {
          listStack.push({ type, indent });
          htmlParts.push(`<${type}>`);
        } else {
          const top = listStack[listStack.length - 1];
          if (indent > top.indent) {
            listStack.push({ type, indent });
            htmlParts.push(`<${type}>`);
          } else if (indent < top.indent) {
            closeListsUpTo(indent);
            if (listStack.length === 0 || listStack[listStack.length - 1].indent < indent) {
              listStack.push({ type, indent });
              htmlParts.push(`<${type}>`);
            }
          } else if (top.type !== type) {
            htmlParts.push(`</${top.type}>`);
            top.type = type;
            htmlParts.push(`<${type}>`);
          }
        }
        htmlParts.push(`<li>${formatInline(content)}</li>`);
        continue;
      }

      flushAllLists();
      flushTable();
      htmlParts.push(`<p>${formatInline(trimmed)}</p>`);
    }

    flushAllLists();
    flushTable();
    return { html: htmlParts.join("\n"), headings };
  }

  // ── Markdown TOC Setup ──────────────────────────────────
  function setupMarkdownToc(headings) {
    if (!mdTocToggle || !markdownToc || !tocList) return;

    if (!headings || headings.length < 3) {
      mdTocToggle.classList.add("hidden");
      markdownToc.classList.add("hidden");
      return;
    }

    mdTocToggle.classList.remove("hidden");
    tocList.innerHTML = "";

    headings.forEach((h) => {
      const a = document.createElement("a");
      a.href = `#${h.slug}`;
      a.className = `toc-link toc-l${h.level}`;
      a.textContent = h.text;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const target = document.getElementById(h.slug);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          history.replaceState(null, "", `#${h.slug}`);
        }
      });
      tocList.appendChild(a);
    });
  }

  if (mdTocToggle) {
    mdTocToggle.addEventListener("click", () => {
      if (markdownToc) markdownToc.classList.toggle("hidden");
    });
  }

  if (tocCloseBtn) {
    tocCloseBtn.addEventListener("click", () => {
      if (markdownToc) markdownToc.classList.add("hidden");
    });
  }

  // ── Previous / Next File Navigation ─────────────────────
  function updateFileNavButtons(item) {
    if (!prevFileBtn || !nextFileBtn) return;
    const viewableSiblings = currentItems.filter((i) => i.type !== "dir" && isViewable(i.name));
    const currentIndex = viewableSiblings.findIndex((i) => i.path === item.path);

    if (currentIndex > 0) {
      prevFileBtn.disabled = false;
      prevFileBtn.title = `Previous: ${viewableSiblings[currentIndex - 1].name} (Arrow Left)`;
    } else {
      prevFileBtn.disabled = true;
      prevFileBtn.title = "No previous file";
    }

    if (currentIndex !== -1 && currentIndex < viewableSiblings.length - 1) {
      nextFileBtn.disabled = false;
      nextFileBtn.title = `Next: ${viewableSiblings[currentIndex + 1].name} (Arrow Right)`;
    } else {
      nextFileBtn.disabled = true;
      nextFileBtn.title = "No next file";
    }
  }

  if (prevFileBtn) {
    prevFileBtn.addEventListener("click", () => {
      if (!currentFile) return;
      const viewableSiblings = currentItems.filter((i) => i.type !== "dir" && isViewable(i.name));
      const idx = viewableSiblings.findIndex((i) => i.path === currentFile.path);
      if (idx > 0) openViewer(viewableSiblings[idx - 1]);
    });
  }

  if (nextFileBtn) {
    nextFileBtn.addEventListener("click", () => {
      if (!currentFile) return;
      const viewableSiblings = currentItems.filter((i) => i.type !== "dir" && isViewable(i.name));
      const idx = viewableSiblings.findIndex((i) => i.path === currentFile.path);
      if (idx !== -1 && idx < viewableSiblings.length - 1) openViewer(viewableSiblings[idx + 1]);
    });
  }

  // ── Open Viewer Master Controller ──────────────────────
  async function openViewer(item, updateHistory = true) {
    currentFile = item;
    hideAll();

    // Show toolbar
    toolbar.classList.remove("hidden");
    toolbarFilename.textContent = item.name;
    toolbarFilename.title = item.name;
    downloadBtn.href = item.download_url || "#";

    updateFileNavButtons(item);
    updateStarredUI();

    if (updateHistory) {
      updateUrl({ file: item.path });
    }

    const ext = getFileExt(item.name);
    const encodedUrl = encodeURIComponent(item.download_url);

    // 1. MARKDOWN NOTES VIEWER
    if (isMarkdown(item.name)) {
      viewer.classList.remove("hidden");
      markdownViewer.classList.remove("hidden");
      viewerLoading.classList.remove("loaded");
      mdReadingTime.textContent = "Loading notes…";
      markdownBody.innerHTML = "";

      try {
        const res = await fetch(item.download_url);
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch notes.`);
        const text = await res.text();
        currentRawText = text;

        const wordCount = text.trim().split(/\s+/).length;
        const readMin = Math.max(1, Math.ceil(wordCount / 200));
        mdReadingTime.textContent = `${readMin} min read • ${wordCount} words`;

        currentBaseRawUrl = getBaseRawUrl(item.download_url);
        const parsed = parseMarkdown(text, currentBaseRawUrl);
        markdownBody.innerHTML = parsed.html;
        setupMarkdownToc(parsed.headings);

        isMarkdownRaw = false;
        mdModeToggle.textContent = "💻 Raw Code";
      } catch (err) {
        markdownBody.innerHTML = `<div class="error-state"><div class="error-icon">⚠️</div><h2>Error loading notes</h2><p>${escapeHtml(err.message)}</p></div>`;
      } finally {
        viewerLoading.classList.add("loaded");
      }
      closeSidebar();
      return;
    }

    // 2. IMAGE PREVIEW (with Mobile Pointer Zoom & Pan)
    if (isImage(item.name)) {
      viewer.classList.remove("hidden");
      mediaViewer.classList.remove("hidden");
      imageViewerContainer.classList.remove("hidden");
      videoViewerContainer.classList.add("hidden");
      audioViewerContainer.classList.add("hidden");
      viewerLoading.classList.remove("loaded");

      resetImageZoom();
      mediaImage.src = item.download_url;
      imageInfo.textContent = "Loading image…";

      mediaImage.onload = () => {
        viewerLoading.classList.add("loaded");
        const w = mediaImage.naturalWidth;
        const h = mediaImage.naturalHeight;
        const sizeStr = item.size ? ` • ${formatSize(item.size)}` : "";
        imageInfo.textContent = `${w} × ${h} px${sizeStr}`;
      };

      mediaImage.onerror = () => {
        viewerLoading.classList.add("loaded");
        imageInfo.textContent = "Error loading image";
      };

      closeSidebar();
      return;
    }

    // 3. VIDEO PREVIEW
    if (isVideo(item.name)) {
      viewer.classList.remove("hidden");
      mediaViewer.classList.remove("hidden");
      videoViewerContainer.classList.remove("hidden");
      imageViewerContainer.classList.add("hidden");
      audioViewerContainer.classList.add("hidden");
      viewerLoading.classList.remove("loaded");

      mediaVideo.src = item.download_url;
      mediaVideo.play().catch(() => {});
      closeSidebar();
      return;
    }

    // 4. AUDIO PREVIEW
    if (isAudio(item.name)) {
      viewer.classList.remove("hidden");
      mediaViewer.classList.remove("hidden");
      audioViewerContainer.classList.remove("hidden");
      imageViewerContainer.classList.add("hidden");
      videoViewerContainer.classList.add("hidden");
      viewerLoading.classList.remove("loaded");

      audioTitle.textContent = item.name;
      audioSub.textContent = `Audio lecture file • ${formatSize(item.size)}`;
      mediaAudio.src = item.download_url;
      mediaAudio.play().catch(() => {});
      closeSidebar();
      return;
    }

    // 5. IN-BROWSER CODE & TEXT VIEWER
    if (isCodeOrText(item.name)) {
      viewer.classList.remove("hidden");
      codeViewer.classList.remove("hidden");
      viewerLoading.classList.remove("loaded");

      const langName = CODE_EXT_MAP[ext] || (ext ? ext.toUpperCase() : "TEXT");
      codeLangBadge.textContent = langName;
      codeStats.textContent = "Loading file…";
      codeLines.innerHTML = "";

      try {
        const res = await fetch(item.download_url);
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch file content.`);
        const text = await res.text();
        currentRawText = text;

        const lines = text.split(/\r\n|\r|\n/);
        const lineCount = lines.length;
        const sizeStr = formatSize(new Blob([text]).size);
        codeStats.textContent = `${lineCount} line${lineCount === 1 ? "" : "s"} • ${sizeStr}`;

        const frag = document.createDocumentFragment();
        lines.forEach((l, idx) => {
          const row = document.createElement("div");
          row.className = "code-line";
          row.innerHTML = `<span class="line-num">${idx + 1}</span><span class="line-code">${highlightSyntax(l, ext)}</span>`;
          frag.appendChild(row);
        });
        codeLines.appendChild(frag);
      } catch (err) {
        codeLines.innerHTML = `<div class="code-line"><span class="line-num">!</span><span class="line-code syn-comment">Error loading file: ${escapeHtml(err.message)}</span></div>`;
        codeStats.textContent = "Error";
      } finally {
        viewerLoading.classList.add("loaded");
      }
      closeSidebar();
      return;
    }

    // 6. DOCUMENTS (PDF, PPT, PPTX, DOC, DOCX, XLS, XLSX)
    if (isDocument(item.name)) {
      viewer.classList.remove("hidden");
      viewerFrame.classList.remove("hidden");
      viewerLoading.classList.remove("loaded");
      viewerFallback.classList.remove("hidden");

      let viewerUrl = "";
      if (ext === "pdf") {
        currentDocEngine = "google";
        viewerUrl = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
        fallbackNotice.textContent = "PDF document viewer";
        fallbackLink.href = item.download_url;
        fallbackLink.textContent = "Open PDF Directly";
      } else {
        currentDocEngine = "office";
        viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
        fallbackNotice.textContent = "Microsoft Office document viewer";
        fallbackLink.href = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
        fallbackLink.textContent = "Open in Google Docs";
      }

      viewerFrame.src = viewerUrl;
      viewerFrame.onload = () => {
        viewerLoading.classList.add("loaded");
      };
      fallbackDownload.href = item.download_url || "#";
      closeSidebar();
    }
  }

  // ── Switch Document Viewer Engine ───────────────────────
  if (fallbackEngineToggle) {
    fallbackEngineToggle.addEventListener("click", () => {
      if (!currentFile) return;
      const encodedUrl = encodeURIComponent(currentFile.download_url);
      const ext = getFileExt(currentFile.name);

      viewerLoading.classList.remove("loaded");

      if (currentDocEngine === "google") {
        if (ext === "pdf") {
          currentDocEngine = "native";
          viewerFrame.src = currentFile.download_url;
          fallbackNotice.textContent = "Native Browser PDF Viewer";
        } else {
          currentDocEngine = "office";
          viewerFrame.src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
          fallbackNotice.textContent = "Office Live Viewer";
        }
      } else if (currentDocEngine === "office") {
        currentDocEngine = "google";
        viewerFrame.src = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
        fallbackNotice.textContent = "Google Docs Viewer";
      } else {
        currentDocEngine = "google";
        viewerFrame.src = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
        fallbackNotice.textContent = "Google Docs Viewer";
      }
    });
  }

  // ── Image Zoom & Pointer Pan Handlers (Mobile + Desktop) ─
  function applyImageTransform() {
    if (!mediaImage) return;
    mediaImage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
    if (zoomLevel) zoomLevel.textContent = `${Math.round(zoomScale * 100)}%`;
  }

  function resetImageZoom() {
    zoomScale = 1;
    panX = 0;
    panY = 0;
    applyImageTransform();
  }

  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", () => {
      zoomScale = Math.min(5, zoomScale + 0.25);
      applyImageTransform();
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", () => {
      zoomScale = Math.max(0.25, zoomScale - 0.25);
      applyImageTransform();
    });
  }

  if (zoomResetBtn) {
    zoomResetBtn.addEventListener("click", () => {
      resetImageZoom();
    });
  }

  if (zoomFitBtn) {
    zoomFitBtn.addEventListener("click", () => {
      resetImageZoom();
    });
  }

  if (imageStage) {
    imageStage.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      zoomScale = Math.max(0.2, Math.min(6, zoomScale + delta));
      applyImageTransform();
    }, { passive: false });

    imageStage.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      isPanning = true;
      startPanX = e.clientX - panX;
      startPanY = e.clientY - panY;
      try { imageStage.setPointerCapture(e.pointerId); } catch {}
    });

    imageStage.addEventListener("pointermove", (e) => {
      if (!isPanning) return;
      panX = e.clientX - startPanX;
      panY = e.clientY - startPanY;
      applyImageTransform();
    });

    const endPan = (e) => {
      if (!isPanning) return;
      isPanning = false;
      try { imageStage.releasePointerCapture(e.pointerId); } catch {}
    };

    imageStage.addEventListener("pointerup", endPan);
    imageStage.addEventListener("pointercancel", endPan);

    imageStage.addEventListener("dblclick", () => {
      resetImageZoom();
    });
  }

  // ── Markdown Raw vs Rendered Toggle ─────────────────────
  if (mdModeToggle) {
    mdModeToggle.addEventListener("click", () => {
      isMarkdownRaw = !isMarkdownRaw;
      if (isMarkdownRaw) {
        mdModeToggle.textContent = "📖 Rendered";
        markdownBody.innerHTML = `<pre><code>${escapeHtml(currentRawText)}</code></pre>`;
        if (markdownToc) markdownToc.classList.add("hidden");
        if (mdTocToggle) mdTocToggle.classList.add("hidden");
      } else {
        mdModeToggle.textContent = "💻 Raw Code";
        const parsed = parseMarkdown(currentRawText, currentBaseRawUrl);
        markdownBody.innerHTML = parsed.html;
        setupMarkdownToc(parsed.headings);
      }
    });
  }

  if (copyMdBtn) {
    copyMdBtn.addEventListener("click", () => {
      if (!currentRawText) return;
      copyToClipboard(currentRawText).then((ok) => {
        if (ok) {
          const orig = copyMdBtn.textContent;
          copyMdBtn.textContent = "✓ Copied!";
          showToast("Notes copied to clipboard!");
          setTimeout(() => { copyMdBtn.textContent = orig; }, 2000);
        } else {
          showToast("Failed to copy notes.");
        }
      });
    });
  }

  // ── Code Wrap Toggle ────────────────────────────────────
  if (codeWrapToggle) {
    codeWrapToggle.addEventListener("click", () => {
      isCodeWrapped = !isCodeWrapped;
      codeScrollArea.classList.toggle("wrap-enabled", isCodeWrapped);
      codeWrapToggle.textContent = isCodeWrapped ? "Wrap: On" : "Wrap: Off";
    });
  }

  // ── Copy Code button ───────────────────────────────────
  if (copyCodeBtn) {
    copyCodeBtn.addEventListener("click", () => {
      if (!currentRawText) return;
      copyToClipboard(currentRawText).then((ok) => {
        if (ok) {
          const original = copyCodeBtn.textContent;
          copyCodeBtn.textContent = "✓ Copied!";
          showToast("Code copied to clipboard!");
          setTimeout(() => { copyCodeBtn.textContent = original; }, 2000);
        } else {
          showToast("Could not copy code to clipboard.");
        }
      });
    });
  }

  // ── Pin / Star toolbar button ──────────────────────────
  if (toolbarStarBtn) {
    toolbarStarBtn.addEventListener("click", () => {
      if (!currentFile) return;
      toggleStar(currentFile);
    });
  }

  // ── Back button ────────────────────────────────────────
  backBtn.addEventListener("click", () => {
    if (currentFile) {
      currentFile = null;
      navigateTo(currentPath, true);
    } else if (currentPath) {
      const parts = currentPath.split("/");
      parts.pop();
      navigateTo(parts.join("/"), true);
    }
  });

  // ── Share button (Toolbar & Topbar) ────────────────────
  function handleShare(btnElement) {
    const shareUrl = window.location.href;
    copyToClipboard(shareUrl).then((ok) => {
      if (ok) {
        showToast("🔗 Link copied to clipboard!");
        if (btnElement) {
          const original = btnElement.textContent;
          btnElement.textContent = "✓ Copied!";
          setTimeout(() => { btnElement.textContent = original; }, 2000);
        }
      } else {
        prompt("Copy this shareable link:", shareUrl);
      }
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener("click", () => handleShare(shareBtn));
  }
  if (topbarShareBtn) {
    topbarShareBtn.addEventListener("click", () => handleShare(topbarShareBtn));
  }

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

  // ── Search & Shortcut Click ────────────────────────────
  if (searchShortcut) {
    searchShortcut.addEventListener("click", () => {
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    });
  }

  // ── Instant Global Search across all Subfolders ────────
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase().trim();

    // Filter sidebar tree items
    const treeItems = fileTree.querySelectorAll(".tree-item");
    treeItems.forEach((el) => {
      const name = el.dataset.name;
      if (!name) {
        el.classList.toggle("hidden", query.length > 0);
        return;
      }
      el.classList.toggle("hidden", !name.includes(query));
    });

    if (currentFile) return;

    if (!query) {
      renderPinnedSection();
      renderFileGrid(currentItems, false);
      return;
    }

    // Hide pinned resources during search
    if (pinnedSection) pinnedSection.classList.add("hidden");

    // Try global search across cached repo tree
    const branch = currentRepo.branch || "HEAD";
    const treeKey = `${currentRepo.platform}_${currentRepo.host}_${currentRepo.owner}_${currentRepo.name}_${branch}`;
    const tree = repoTreeCache[treeKey];

    if (tree && Array.isArray(tree)) {
      const matches = tree.filter((it) => it.name.toLowerCase().includes(query) || it.path.toLowerCase().includes(query));
      renderFileGrid(matches, true);
    } else {
      const filtered = currentItems.filter((it) => it.name.toLowerCase().includes(query));
      renderFileGrid(filtered, false);
    }
  });

  // ── Keyboard Shortcuts (/, Ctrl+K, Escape, Arrows) ─────
  window.addEventListener("keydown", (e) => {
    const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);

    // '/' or 'Ctrl+K' / 'Cmd+K' focuses search
    if ((e.key === "/" && !isInput) || ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K"))) {
      e.preventDefault();
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
      return;
    }

    // Escape clears search / closes modals / goes back
    if (e.key === "Escape") {
      if (document.activeElement === searchInput) {
        searchInput.blur();
        if (searchInput.value) {
          searchInput.value = "";
          searchInput.dispatchEvent(new Event("input"));
        }
        return;
      }
      if (devOverlay && !devOverlay.classList.contains("hidden")) {
        closeDevModal();
        return;
      }
      if (repoSwitcherDropdown && !repoSwitcherDropdown.classList.contains("hidden")) {
        closeRepoSwitcher();
        return;
      }
      if (markdownToc && !markdownToc.classList.contains("hidden")) {
        markdownToc.classList.add("hidden");
        return;
      }
      if (currentFile && backBtn) {
        backBtn.click();
        return;
      }
    }

    // Arrow navigation when viewing files
    if (currentFile && !isInput) {
      if (e.key === "ArrowLeft" && prevFileBtn && !prevFileBtn.disabled) {
        e.preventDefault();
        prevFileBtn.click();
      } else if (e.key === "ArrowRight" && nextFileBtn && !nextFileBtn.disabled) {
        e.preventDefault();
        nextFileBtn.click();
      }
    }
  });

  // ── Error handling ─────────────────────────────────────
  function showError(msg) {
    hideAll();
    errorState.classList.remove("hidden");
    errorMessage.textContent = msg || "An unexpected error occurred.";
  }

  retryBtn.addEventListener("click", () => {
    const branch = currentRepo.branch || "HEAD";
    const treeKey = `${currentRepo.platform}_${currentRepo.host}_${currentRepo.owner}_${currentRepo.name}_${branch}`;
    delete repoTreeCache[treeKey];
    sessionStorage.removeItem(`studyportal_tree_${treeKey}`);
    sessionStorage.removeItem(`${CACHE_PREFIX}${currentRepo.platform}_${currentRepo.host}_${currentRepo.owner}_${currentRepo.name}_${currentPath}`);
    navigateTo(currentPath);
  });

  // ── Developer Mode (7 clicks on logo) ──────────────────
  let logoClicks = 0;
  let logoClickTimer = null;

  if (logo) {
    logo.addEventListener("click", () => {
      logoClicks++;
      if (logoClickTimer) clearTimeout(logoClickTimer);
      logoClickTimer = setTimeout(() => {
        logoClicks = 0;
      }, 3000);

      if (logoClicks > 3 && logoClicks < 7) {
        const remaining = 7 - logoClicks;
        showToast(`You are now ${remaining} step${remaining === 1 ? "" : "s"} away from Developer Options.`);
      } else if (logoClicks >= 7) {
        logoClicks = 0;
        showToast("Developer Options opened!");
        openDevModal();
      }
    });
  }

  function openDevModal() {
    if (!devOverlay) return;
    const currentUrl = isDefaultRepo()
      ? `https://github.com/${currentRepo.owner}/${currentRepo.name}`
      : (currentRepo.host ? `https://${currentRepo.host}/${currentRepo.owner}/${currentRepo.name}` : `${currentRepo.owner}/${currentRepo.name}`);
    devRepoInput.value = currentUrl;
    renderRecentReposList();
    devOverlay.classList.remove("hidden");
    setTimeout(() => {
      devRepoInput.focus();
      devRepoInput.select();
    }, 100);
  }

  function closeDevModal() {
    if (!devOverlay) return;
    devOverlay.classList.add("hidden");
  }

  // ── Smart Multi-Platform URL / Shorthand Parser ────────
  function parseRepoUrl(input) {
    let str = (input || "").trim();
    if (!str) return null;

    let platformHint = null;
    if (/^(gl|gitlab):/i.test(str)) {
      platformHint = "gitlab";
      str = str.replace(/^(gl|gitlab):/i, "");
    } else if (/^(cb|codeberg):/i.test(str)) {
      platformHint = "codeberg";
      str = str.replace(/^(cb|codeberg):/i, "");
    } else if (/^(bb|bitbucket):/i.test(str)) {
      platformHint = "bitbucket";
      str = str.replace(/^(bb|bitbucket):/i, "");
    } else if (/^(gh|github):/i.test(str)) {
      platformHint = "github";
      str = str.replace(/^(gh|github):/i, "");
    }

    if (!/^https?:\/\//i.test(str) && (str.includes(".com/") || str.includes(".org/") || str.includes(".io/") || str.includes(".net/"))) {
      str = "https://" + str;
    }

    if (/^https?:\/\//i.test(str)) {
      try {
        const url = new URL(str);
        const host = url.hostname.toLowerCase();
        let pathSegments = url.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
        if (pathSegments.length > 0 && pathSegments[pathSegments.length - 1].endsWith(".git")) {
          pathSegments[pathSegments.length - 1] = pathSegments[pathSegments.length - 1].replace(/\.git$/, "");
        }

        if (host === "github.com") {
          if (pathSegments.length < 2) return null;
          const owner = pathSegments[0];
          const name = pathSegments[1];
          let branch = "HEAD";
          if (pathSegments[2] === "tree" && pathSegments[3]) {
            branch = pathSegments[3];
          }
          return { platform: "github", host, owner, name, branch };
        }

        if (host === "gitlab.com") {
          if (pathSegments.length < 2) return null;
          const dashIdx = pathSegments.indexOf("-");
          let branch = "HEAD";
          let projectSegments = pathSegments;
          if (dashIdx !== -1) {
            projectSegments = pathSegments.slice(0, dashIdx);
            if (pathSegments[dashIdx + 1] === "tree" && pathSegments[dashIdx + 2]) {
              branch = pathSegments[dashIdx + 2];
            }
          }
          if (projectSegments.length < 2) return null;
          const name = projectSegments[projectSegments.length - 1];
          const owner = projectSegments.slice(0, -1).join("/");
          return { platform: "gitlab", host, owner, name, branch };
        }

        if (host === "codeberg.org") {
          if (pathSegments.length < 2) return null;
          const owner = pathSegments[0];
          const name = pathSegments[1];
          let branch = "HEAD";
          if (pathSegments[2] === "src" && pathSegments[3] === "branch" && pathSegments[4]) {
            branch = pathSegments[4];
          }
          return { platform: "codeberg", host, owner, name, branch };
        }

        if (host === "bitbucket.org") {
          if (pathSegments.length < 2) return null;
          const owner = pathSegments[0];
          const name = pathSegments[1];
          let branch = "HEAD";
          if (pathSegments[2] === "src" && pathSegments[3]) {
            branch = pathSegments[3];
          }
          return { platform: "bitbucket", host, owner, name, branch };
        }

        if (pathSegments.length >= 2) {
          const owner = pathSegments[0];
          const name = pathSegments[1];
          const platform = platformHint || (host.includes("gitlab") ? "gitlab" : "gitea");
          return { platform, host, owner, name, branch: "HEAD" };
        }
      } catch {
        return null;
      }
    }

    const parts = str.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "").split("/").filter(Boolean);
    if (parts.length >= 2) {
      const platform = platformHint || "github";
      const host = platform === "gitlab" ? "gitlab.com" : platform === "codeberg" ? "codeberg.org" : platform === "bitbucket" ? "bitbucket.org" : "github.com";
      const name = parts[parts.length - 1];
      const owner = parts.slice(0, -1).join("/");
      return { platform, host, owner, name, branch: "HEAD" };
    }

    return null;
  }

  function loadCustomRepo(parsedRepo) {
    currentRepo = parsedRepo;
    saveRecentRepo(parsedRepo);
    updateRepoUI();
    const platInfo = PLATFORMS[parsedRepo.platform] || { icon: "📁" };
    showToast(`Loaded ${platInfo.icon} ${parsedRepo.owner}/${parsedRepo.name}`);
    fetchRepoTree(parsedRepo).catch(() => {});
    navigateTo("");
  }

  function applyCustomRepo() {
    const val = (devRepoInput.value || "").trim();
    if (!val) return;

    const parsed = parseRepoUrl(val);
    if (!parsed) {
      showToast("Invalid format. Enter a GitHub/GitLab/Codeberg URL or owner/repo.");
      return;
    }

    closeDevModal();
    loadCustomRepo(parsed);
  }

  function resetToDefaultRepo() {
    currentRepo = { ...DEFAULT_REPO };
    updateRepoUI();
    closeDevModal();
    showToast("Reset to default repository (TYBCA)");
    fetchRepoTree(currentRepo).catch(() => {});
    navigateTo("");
  }

  if (devApply) devApply.addEventListener("click", applyCustomRepo);
  if (devReset) devReset.addEventListener("click", resetToDefaultRepo);
  if (devCancel) devCancel.addEventListener("click", closeDevModal);
  if (devClose) devClose.addEventListener("click", closeDevModal);
  if (devOverlay) {
    devOverlay.addEventListener("click", (e) => {
      if (e.target === devOverlay) closeDevModal();
    });
  }

  if (devRepoInput) {
    devRepoInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyCustomRepo();
      } else if (e.key === "Escape") {
        closeDevModal();
      }
    });
  }

  if (devPlatformsGuide) {
    devPlatformsGuide.addEventListener("click", (e) => {
      const chip = e.target.closest(".platform-chip");
      if (!chip) return;
      const example = chip.dataset.example;
      if (example && devRepoInput) {
        devRepoInput.value = example;
        devRepoInput.focus();
        devRepoInput.select();
      }
    });
  }

  // ── Browser Back/Forward (popstate) ────────────────────
  window.addEventListener("popstate", async () => {
    const params = new URLSearchParams(window.location.search);
    const repoParam = params.get("repo");
    const fileParam = params.get("file");
    const pathParam = params.get("path") || "";

    if (repoParam) {
      const parsed = parseRepoUrl(repoParam);
      if (parsed) {
        currentRepo = parsed;
        updateRepoUI();
      }
    } else {
      currentRepo = { ...DEFAULT_REPO };
      updateRepoUI();
    }

    if (fileParam) {
      const normFile = fileParam.replace(/^\/+|\/+$/g, "");
      const folderPath = normFile.includes("/") ? normFile.substring(0, normFile.lastIndexOf("/")) : "";
      try {
        const items = await fetchContents(folderPath);
        currentItems = Array.isArray(items) ? items : [];
        const target = currentItems.find((it) => it.path === normFile || it.name === normFile.split("/").pop());
        if (target && isViewable(target.name)) {
          openViewer(target, false);
          return;
        }
      } catch { /* ignore */ }
    }

    if (currentFile) {
      currentFile = null;
    }
    navigateTo(pathParam, false);
  });

  // ── Boot with Deep Link Routing ────────────────────────
  async function boot() {
    updateRepoUI();

    const params = new URLSearchParams(window.location.search);
    const repoParam = params.get("repo");
    const fileParam = params.get("file");
    const pathParam = params.get("path");

    // 1. Repo deep link
    if (repoParam) {
      const parsed = parseRepoUrl(repoParam);
      if (parsed) {
        currentRepo = parsed;
        saveRecentRepo(parsed);
        updateRepoUI();
      }
    }

    // Pre-fetch tree in background to speed up navigation and enable instant global search
    fetchRepoTree(currentRepo).catch(() => {});

    // 2. Direct file deep link
    if (fileParam) {
      const normFile = fileParam.replace(/^\/+|\/+$/g, "");
      const folderPath = normFile.includes("/") ? normFile.substring(0, normFile.lastIndexOf("/")) : "";
      const fileName = normFile.includes("/") ? normFile.substring(normFile.lastIndexOf("/") + 1) : normFile;

      currentPath = folderPath;
      renderBreadcrumbs(folderPath);

      try {
        const items = await fetchContents(folderPath);
        currentItems = Array.isArray(items) ? items : [];
        currentItems.sort((a, b) => {
          if (a.type === "dir" && b.type !== "dir") return -1;
          if (a.type !== "dir" && b.type === "dir") return 1;
          return a.name.localeCompare(b.name);
        });
        renderPinnedSection();
        renderFileGrid(currentItems);
        renderSidebarTree(currentItems);

        const target = currentItems.find((it) => it.path === normFile || it.name.toLowerCase() === fileName.toLowerCase());
        if (target && isViewable(target.name)) {
          openViewer(target, false);
          return;
        }
      } catch (err) {
        showError(err.message);
        return;
      }
    }

    // 3. Path deep link
    if (pathParam !== null) {
      navigateTo(pathParam, false);
      return;
    }

    // 4. Fallback to localStorage session memory (default repo only)
    let startPath = "";
    if (isDefaultRepo()) {
      try {
        const saved = localStorage.getItem(LAST_PATH_KEY);
        if (saved) startPath = saved;
      } catch { /* ignore */ }
    }
    navigateTo(startPath, false);
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
