(function (projLib) {
  'use strict';

  // Defaults (overridden by hubData.json if present)
  let HUB_DATA = null;
  let BLACKLISTED_DOMAINS = [
    "wix.com", "google.com", "youtube.com",
    "facebook.com", "2ix2.com", "sporttvhdonlinetvs.com"
  ];
  let DEFAULT_HOME = "https://archive.org";

  // ---------- Utilities ----------
  projLib.isValidUrl = function (e) {
    try {
      const u = new URL(e.startsWith("http") ? e : "https://" + e);
      return u.hostname.includes(".") || u.hostname === "localhost";
    } catch {
      return false;
    }
  };

  projLib.sanitizeText = function (e) {
    const t = document.createElement("div");
    t.textContent = e;
    return t.innerHTML;
  };

  projLib.fetchWithTimeout = function (url, opts, timeoutMs) {
    opts = opts || {};
    timeoutMs = timeoutMs || 15000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...opts, signal: controller.signal })
      .then(resp => { clearTimeout(timer); return resp; })
      .catch(err => { clearTimeout(timer); throw err; });
  };

  projLib.fetchWithRetry = function (url, opts, retries, timeoutMs) {
    retries = retries === undefined ? 2 : retries;
    timeoutMs = timeoutMs || 15000;
    return projLib.fetchWithTimeout(url, opts, timeoutMs).catch(err => {
      if (retries > 0) return projLib.fetchWithRetry(url, opts, retries - 1, timeoutMs);
      throw err;
    });
  };

  // ---------- RSS / Ticker ----------
  projLib.fetchRSSFeed = function (feedUrl, cacheMs) {
    cacheMs = cacheMs || 600000;
    const key = "rssFeedCache_" + feedUrl;
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < cacheMs) return Promise.resolve(parsed.data);
      } catch { /* ignore cache parse error */ }
    }
    const proxy = "https://api.allorigins.win/get?url=" + encodeURIComponent(feedUrl);
    return projLib.fetchWithRetry(proxy)
      .then(resp => { if (!resp.ok) throw new Error("Network response error"); return resp.json(); })
      .then(data => {
        localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data: data.contents }));
        return data.contents;
      });
  };

  projLib.updateTicker = function () {
    projLib.fetchRSSFeed("https://www.rtp.pt/noticias/rss/mundo").then(function (xmlStr) {
      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlStr, "text/xml");
      const items = xml.getElementsByTagName("item");
      let html = "";
      for (let i = 0; i < items.length; i++) {
        const title = items[i].getElementsByTagName("title")[0];
        const link = items[i].getElementsByTagName("link")[0];
        if (title && link) {
          const safeTitle = projLib.sanitizeText(title.textContent);
          const href = link.textContent;
          html += `<a href="${href}" target="_blank" style="color: inherit; text-decoration: none; margin-right: 20px;">${safeTitle}</a> | `;
        }
      }
      if (html.endsWith(" | ")) html = html.slice(0, -3);
      const tickerEl = document.querySelector(".ticker");
      tickerEl.innerHTML = html;

      const containerWidth = document.querySelector(".ticker-container").offsetWidth;
      const contentWidth = tickerEl.scrollWidth;
      if (contentWidth > containerWidth) {
        const duration = contentWidth / 50;
        tickerEl.style.animationDuration = duration + "s";
      } else {
        tickerEl.style.animation = "none";
      }
    }).catch(function () {
      projLib.notifyUser("Failed to load news feed.");
      document.querySelector(".ticker").innerText = "Failed to load news feed.";
    });
  };

  // ---------- UI helpers ----------
  projLib.notifyUser = function (msg) {
    const t = document.getElementById("notification");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 4000);
  };

  projLib.applyTheme = function (mode) {
    mode === "light"
      ? document.body.classList.add("light-theme")
      : document.body.classList.remove("light-theme");
  };

  projLib.toggleTheme = function () {
    if (document.body.classList.contains("light-theme")) {
      document.body.classList.remove("light-theme");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.add("light-theme");
      localStorage.setItem("theme", "light");
    }
  };

  // ---------- Iframe loading ----------
  projLib.processLoadUrl = function (input) {
    let t = (input || "").trim();
    if (!t) return;

    if (!projLib.isValidUrl(t)) t = "https://swisscows.com/web?query=" + encodeURIComponent(t);
    if (!t.startsWith("http://") && !t.startsWith("https://")) t = "https://" + t;

    document.getElementById("currentUrl").value = t;

    const frame = document.getElementById("proxyFrame");
    frame.removeAttribute("srcdoc");
    frame.style.display = "block";
    document.getElementById("initialMessage").style.display = "none";

    const overlay = document.getElementById("loadingOverlay");
    overlay.style.display = "flex";
    frame.onload = function () { overlay.style.display = "none"; };
    frame.onerror = function () { overlay.style.display = "none"; projLib.notifyUser("Failed to load the content."); };

    const parsedUrl = new URL(t);
    const isBlacklisted = (BLACKLISTED_DOMAINS || []).some(domain => parsedUrl.hostname.endsWith(domain));
    if (isBlacklisted) {
      frame.setAttribute('sandbox', 'allow-forms allow-scripts allow-same-origin allow-popups');
    } else {
      frame.removeAttribute('sandbox');
    }
    frame.src = t;
  };

  projLib.fullscreenProxy = function () {
    const e = document.getElementById("proxyFrame");
    if (e.requestFullscreen) e.requestFullscreen();
    else if (e.webkitRequestFullscreen) e.webkitRequestFullscreen();
    else if (e.msRequestFullscreen) e.msRequestFullscreen();
  };

  // ---------- Dynamic hub loading ----------
  projLib.loadHubData = function (path) {
    const cacheKey = "hubDataCache";
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try { HUB_DATA = JSON.parse(cached); } catch { HUB_DATA = null; }
    }
    return projLib.fetchWithRetry(path, {}, 2, 10000)
      .then(resp => {
        if (!resp.ok) throw new Error("Failed to fetch hubData.json");
        return resp.json();
      })
      .then(data => {
        HUB_DATA = data;
        localStorage.setItem(cacheKey, JSON.stringify(data));
        if (Array.isArray(data.blacklistedDomains)) BLACKLISTED_DOMAINS = data.blacklistedDomains;
        if (typeof data.defaultHome === "string" && data.defaultHome) DEFAULT_HOME = data.defaultHome;
        return data;
      })
      .catch(() => {
        if (!HUB_DATA) projLib.notifyUser("Could not load hub data; using defaults.");
        return HUB_DATA || { categories: [] };
      });
  };

  projLib.populateDropdowns = function (data) {
    if (!data || !Array.isArray(data.categories)) return;

    data.categories.forEach(cat => {
      const select = document.getElementById(cat.id);
      if (!select) return;

      // Clear and rebuild
      select.innerHTML = "";

      // Placeholder option
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = cat.label || "Select";
      select.appendChild(placeholder);

      // Links
      if (Array.isArray(cat.links)) {
        const frag = document.createDocumentFragment();
        cat.links.forEach(link => {
          if (!link || !link.url || !link.name) return;
          const opt = document.createElement("option");
          opt.value = link.url;
          opt.textContent = link.name;
          frag.appendChild(opt);
        });
        select.appendChild(frag);
      }
    });
  };

  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", function () {
    // Theme
    let theme = localStorage.getItem("theme");
    if (theme !== "light" && theme !== "dark") theme = "dark";
    projLib.applyTheme(theme);

    // Ticker
    projLib.updateTicker();
    setInterval(projLib.updateTicker, 600000);

    // Load hub data then initialize UI
    projLib.loadHubData("./hubData.json").then(data => {
      projLib.populateDropdowns(data);
      projLib.processLoadUrl(DEFAULT_HOME);
    });

    // Events
    document.getElementById("proxyForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      const t = document.getElementById("urlInput").value;
      projLib.processLoadUrl(t);
    });

    document.getElementById("homeBtn").addEventListener("click", function () {
      projLib.processLoadUrl(DEFAULT_HOME);
    });

    document.getElementById("refreshBtn").addEventListener("click", function () {
      const e = document.getElementById("currentUrl").value;
      if (e) projLib.processLoadUrl(e);
    });

    document.querySelector(".row").addEventListener("change", function (ev) {
      if (ev.target.tagName.toLowerCase() === "select" && ev.target.value) {
        projLib.processLoadUrl(ev.target.value);
        ev.target.selectedIndex = 0;
      }
    });

    document.getElementById("toggleTheme").addEventListener("click", projLib.toggleTheme);
  });

  window.projLib = projLib;
})(window.projLib || {});
