/* =========================================================
   TYBCA Study Portal – app.js
   Pure vanilla JS, zero dependencies.
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

  const PLATFORMS = {
    github: { name: "GitHub", icon: "🐙", host: "github.com" },
    gitlab: { name: "GitLab", icon: "🦊", host: "gitlab.com" },
    codeberg: { name: "Codeberg", icon: "🏔️", host: "codeberg.org" },
    gitea: { name: "Gitea", icon: "☕", host: "gitea.com" },
    bitbucket: { name: "Bitbucket", icon: "🪣", host: "bitbucket.org" }
  };

  function isDefaultRepo() {
    return (
      currentRepo.platform === DEFAULT_REPO.platform &&
      currentRepo.host === DEFAULT_REPO.host &&
      currentRepo.owner === DEFAULT_REPO.owner &&
      currentRepo.name === DEFAULT_REPO.name
    );
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
  const fileTree = document.getElementById("fileTree");
  const sidebarLoader = document.getElementById("sidebarLoader");
  const breadcrumbs = document.getElementById("breadcrumbs");
  const toolbar = document.getElementById("toolbar");
  const toolbarFilename = document.getElementById("toolbarFilename");
  const backBtn = document.getElementById("backBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const shareBtn = document.getElementById("shareBtn");
  const fileGrid = document.getElementById("fileGrid");
  const contentLoader = document.getElementById("contentLoader");
  const viewer = document.getElementById("viewer");
  const viewerLoading = document.getElementById("viewerLoading");
  const viewerFrame = document.getElementById("viewerFrame");
  const codeViewer = document.getElementById("codeViewer");
  const codeLangBadge = document.getElementById("codeLangBadge");
  const codeStats = document.getElementById("codeStats");
  const copyCodeBtn = document.getElementById("copyCodeBtn");
  const codeLines = document.getElementById("codeLines");
  const viewerFallback = document.getElementById("viewerFallback");
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
  const devCancel = document.getElementById("devCancel");
  const devApply = document.getElementById("devApply");
  const devReset = document.getElementById("devReset");
  const devClose = document.getElementById("devClose");

  // ── State ───────────────────────────────────────────────
  let currentPath = "";
  let currentItems = [];
  let currentFile = null; // { name, download_url, html_url, ... }
  let currentRawCode = "";

  // ── Code Extensions & Languages ─────────────────────────
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
    md: "Markdown", markdown: "Markdown",
    txt: "Plain Text", log: "Log",
    sh: "Shell", bash: "Bash", zsh: "Zsh", bat: "Batch", ps1: "PowerShell",
    dockerfile: "Dockerfile", makefile: "Makefile"
  };

  // ── Helpers ─────────────────────────────────────────────
  function getFileExt(name) {
    return (name.split(".").pop() || "").toLowerCase();
  }

  function isCodeOrText(name) {
    const ext = getFileExt(name);
    if (ext in CODE_EXT_MAP) return true;
    const lower = name.toLowerCase();
    return ["dockerfile", "makefile", "license", "readme", ".gitignore", ".env"].includes(lower);
  }

  function isViewable(name) {
    const ext = getFileExt(name);
    return ["pdf", "ppt", "pptx"].includes(ext) || isCodeOrText(name);
  }

  function getIcon(item) {
    if (item.type === "dir") return "📁";
    const ext = getFileExt(item.name);
    if (ext === "pdf") return "📄";
    if (["ppt", "pptx"].includes(ext)) return "📊";
    if (["doc", "docx"].includes(ext)) return "📝";
    if (["xls", "xlsx"].includes(ext)) return "📊";
    if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext)) return "🖼️";
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "📦";
    if (["mp4", "mkv", "avi", "mov"].includes(ext)) return "🎬";
    if (["py", "js", "ts", "html", "css", "java", "c", "cpp", "cs", "sql", "sh", "rs", "go"].includes(ext)) return "💻";
    if (["txt", "md", "log", "json", "yaml", "yml"].includes(ext)) return "📝";
    return "📄";
  }

  function formatSize(bytes) {
    if (bytes == null) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
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

    // Filter out dotfiles (e.g. .gitignore)
    const cleaned = (items || []).filter((item) => !item.name.startsWith("."));

    // Cache the directory listings
    if (Array.isArray(cleaned)) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(cleaned));
      } catch { /* storage full */ }
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
      <button aria-label="Dismiss">✕</button>
    `;
    banner.querySelector("button").addEventListener("click", () => banner.remove());
    document.getElementById("main").prepend(banner);
  }

  // ── URL & Deep Linking ──────────────────────────────────
  function updateUrl({ path, file } = {}, replace = false) {
    const url = new URL(window.location.origin + window.location.pathname);

    // Repo param
    if (!isDefaultRepo()) {
      if (currentRepo.platform === "github" && currentRepo.host === "github.com") {
        url.searchParams.set("repo", `${currentRepo.owner}/${currentRepo.name}`);
      } else if (currentRepo.host === "gitlab.com") {
        url.searchParams.set("repo", `gl:${currentRepo.owner}/${currentRepo.name}`);
      } else if (currentRepo.host === "codeberg.org") {
        url.searchParams.set("repo", `cb:${currentRepo.owner}/${currentRepo.name}`);
      } else if (currentRepo.host === "bitbucket.org") {
        url.searchParams.set("repo", `bb:${currentRepo.owner}/${currentRepo.name}`);
      } else {
        url.searchParams.set("repo", `https://${currentRepo.host}/${currentRepo.owner}/${currentRepo.name}`);
      }
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

    // Persist last visited path for session restore (default repo only)
    if (isDefaultRepo()) {
      try { localStorage.setItem(LAST_PATH_KEY, path); } catch { /* quota */ }
    }

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
    codeViewer.classList.add("hidden");
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
    codeViewer.classList.add("hidden");
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
      // Non-viewable: trigger download
      window.open(item.download_url, "_blank");
    }
  }

  // ── Escape HTML ────────────────────────────────────────
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Syntax Highlighter (Zero-dependency) ───────────────
  function highlightSyntax(lineText, ext) {
    if (!lineText) return "&nbsp;";
    const e = (ext || "").toLowerCase();

    let escaped = escapeHtml(lineText);

    // Comments
    let commentText = "";
    if (["js", "ts", "jsx", "tsx", "java", "c", "cpp", "h", "hpp", "cs", "go", "rs", "php", "css"].includes(e)) {
      const idx = escaped.indexOf("//");
      if (idx !== -1) {
        commentText = escaped.substring(idx);
        escaped = escaped.substring(0, idx);
      }
    } else if (["py", "sh", "bash", "zsh", "yaml", "yml", "toml", "ini", "dockerfile", "makefile", "rb", "env"].includes(e)) {
      const idx = escaped.indexOf("#");
      if (idx !== -1) {
        commentText = escaped.substring(idx);
        escaped = escaped.substring(0, idx);
      }
    } else if (["sql"].includes(e)) {
      const idx = escaped.indexOf("--");
      if (idx !== -1) {
        commentText = escaped.substring(idx);
        escaped = escaped.substring(0, idx);
      }
    } else if (["html", "xml", "svg"].includes(e)) {
      const idx = escaped.indexOf("&lt;!--");
      if (idx !== -1) {
        commentText = escaped.substring(idx);
        escaped = escaped.substring(0, idx);
      }
    }

    // Strings
    escaped = escaped.replace(/(&quot;.*?&quot;|&#39;.*?&#39;|`.*?`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, '<span class="syn-string">$1</span>');

    // Numbers
    escaped = escaped.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="syn-number">$1</span>');

    // Keywords
    const keywords = [
      "function", "def", "class", "import", "from", "export", "default", "return", "if", "else", "elif",
      "for", "while", "do", "switch", "case", "break", "continue", "try", "catch", "except", "finally",
      "throw", "raise", "async", "await", "new", "this", "self", "const", "let", "var", "public",
      "private", "protected", "static", "void", "int", "float", "double", "boolean", "bool", "string",
      "char", "struct", "enum", "interface", "type", "package", "namespace", "using", "fn", "mut",
      "SELECT", "FROM", "WHERE", "INSERT", "INTO", "UPDATE", "DELETE", "JOIN", "LEFT", "RIGHT", "INNER",
      "GROUP", "BY", "ORDER", "HAVING", "LIMIT", "CREATE", "TABLE", "DATABASE", "DROP", "ALTER", "AS",
      "AND", "OR", "NOT", "IN", "IS", "NULL"
    ];
    const kwRegex = new RegExp(`\\b(${keywords.join("|")})\\b`, "g");
    escaped = escaped.replace(kwRegex, '<span class="syn-keyword">$1</span>');

    // Booleans & null
    escaped = escaped.replace(/\b(true|false|True|False|null|undefined|None|nil)\b/g, '<span class="syn-bool">$1</span>');

    // HTML / XML tags
    if (["html", "xml", "svg", "jsx", "tsx"].includes(e)) {
      escaped = escaped.replace(/(&lt;\/?[a-zA-Z0-9\-]+)(&gt;|\s)/g, '<span class="syn-tag">$1</span>$2');
    }

    // Append comment
    if (commentText) {
      escaped += `<span class="syn-comment">${commentText}</span>`;
    }

    return escaped;
  }

  // ── Document & Code viewer ─────────────────────────────
  async function openViewer(item, updateHistory = true) {
    currentFile = item;
    hideAll();

    // Show toolbar
    toolbar.classList.remove("hidden");
    toolbarFilename.textContent = item.name;
    toolbarFilename.title = item.name;
    downloadBtn.href = item.download_url || "#";

    if (updateHistory) {
      updateUrl({ file: item.path });
    }

    const ext = getFileExt(item.name);
    const encodedUrl = encodeURIComponent(item.download_url);

    if (isCodeOrText(item.name)) {
      // CODE & TEXT VIEWER
      viewer.classList.remove("hidden");
      viewerFrame.classList.add("hidden");
      viewerFallback.classList.add("hidden");
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
        currentRawCode = text;

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
    } else {
      // PDF & PPTX EMBEDDED VIEWER
      codeViewer.classList.add("hidden");
      viewerFrame.classList.remove("hidden");
      viewerLoading.classList.remove("loaded");

      let viewerUrl = "";
      if (ext === "pdf") {
        viewerUrl = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
      } else if (["ppt", "pptx"].includes(ext)) {
        viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
      }

      viewer.classList.remove("hidden");
      viewerFrame.src = viewerUrl;

      viewerFrame.onload = () => {
        viewerLoading.classList.add("loaded");
      };

      // Fallback bar
      viewerFallback.classList.remove("hidden");
      if (ext === "pdf") {
        fallbackLink.href = item.download_url;
        fallbackLink.textContent = "Open PDF Directly";
      } else {
        fallbackLink.href = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
        fallbackLink.textContent = "Open in Google Docs Viewer";
      }
      fallbackDownload.href = item.download_url || "#";
    }

    closeSidebar();
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

  // ── Share button ───────────────────────────────────────
  if (shareBtn) {
    shareBtn.addEventListener("click", () => {
      const shareUrl = window.location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
          showToast("Shareable link copied to clipboard! 🔗");
        }).catch(() => {
          prompt("Copy this shareable link:", shareUrl);
        });
      } else {
        prompt("Copy this shareable link:", shareUrl);
      }
    });
  }

  // ── Copy Code button ───────────────────────────────────
  if (copyCodeBtn) {
    copyCodeBtn.addEventListener("click", () => {
      if (!currentRawCode) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(currentRawCode).then(() => {
          const original = copyCodeBtn.textContent;
          copyCodeBtn.textContent = "✓ Copied!";
          showToast("Code copied to clipboard!");
          setTimeout(() => { copyCodeBtn.textContent = original; }, 2000);
        }).catch(() => {
          showToast("Could not copy to clipboard.");
        });
      }
    });
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
    sessionStorage.removeItem(`${CACHE_PREFIX}${currentRepo.platform}_${currentRepo.host}_${currentRepo.owner}_${currentRepo.name}_${currentPath}`);
    navigateTo(currentPath);
  });


  // ── Toast Pill (Android-style) ─────────────────────────
  let toastTimeout = null;
  function showToast(msg, duration = 2000) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove("hidden");
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.add("hidden");
    }, duration);
  }

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

    // Detect prefix shorthands
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

    // Auto-prepend https:// if looks like a domain
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

        // Self-hosted Gitea / GitLab
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

    // Shorthand format: owner/repo
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

  function applyCustomRepo() {
    const val = (devRepoInput.value || "").trim();
    if (!val) return;

    const parsed = parseRepoUrl(val);
    if (!parsed) {
      showToast("Invalid format. Enter a GitHub/GitLab/Codeberg URL or owner/repo.");
      return;
    }

    currentRepo = parsed;
    updateRepoUI();
    closeDevModal();
    const platInfo = PLATFORMS[parsed.platform] || { icon: "📁" };
    showToast(`Loaded ${platInfo.icon} ${parsed.owner}/${parsed.name}`);
    navigateTo("");
  }

  function resetToDefaultRepo() {
    currentRepo = { ...DEFAULT_REPO };
    updateRepoUI();
    closeDevModal();
    showToast("Reset to default repository (TYBCA)");
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

  // Clickable platform chips in Developer Options
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

    // 1. Repo deep link (e.g. ?repo=owner/repo or ?repo=https://gitlab.com/...)
    if (repoParam) {
      const parsed = parseRepoUrl(repoParam);
      if (parsed) {
        currentRepo = parsed;
        updateRepoUI();
      }
    }

    // 2. Direct file deep link (e.g. ?file=DMW/Unit1.pdf or ?repo=...&file=slides.pptx)
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

    // 3. Path deep link (e.g. ?path=DMW)
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
