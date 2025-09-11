/* js/apps.js
   Full single-file application:
   - Loads hubData.json and populates dropdowns
   - Scanner toggle + form submit -> loads iframe
   - Home / Refresh / Fullscreen buttons
   - Theme toggle (8 themes) with per-theme effects
   - No ticker
*/

(function (ProjLib) {
  'use strict';

  // ---------- state ----------
  let HUB_DATA = null;
  let DEFAULT_HOME = null;
  const THEME_LIST = ['dark','kuromi','comic','cyberpunk','geek','tech','anime','minimal'];
  let themeIndex = 0;

  // theme-effect bookkeeping (only theme-related intervals/timeouts/listeners)
  const EFFECTS = {
    intervals: [],
    timeouts: [],
    listeners: []
  };

  // small helpers
  const $ = id => document.getElementById(id);
  const q = sel => document.querySelector(sel);
  const qAll = sel => Array.from(document.querySelectorAll(sel));

  // effect registration helpers
  function addInterval(id) { EFFECTS.intervals.push(id); return id; }
  function addTimeout(id) { EFFECTS.timeouts.push(id); return id; }
  function addEffectListener(target, ev, fn, opts) { target.addEventListener(ev, fn, opts || false); EFFECTS.listeners.push({ target, ev, fn, opts }); }

  function clearThemeEffects() {
    // intervals
    EFFECTS.intervals.forEach(i => clearInterval(i));
    EFFECTS.intervals.length = 0;
    // timeouts
    EFFECTS.timeouts.forEach(t => clearTimeout(t));
    EFFECTS.timeouts.length = 0;
    // listeners
    EFFECTS.listeners.forEach(l => {
      try { l.target.removeEventListener(l.ev, l.fn, l.opts); } catch (e) { /* ignore */ }
    });
    EFFECTS.listeners.length = 0;
    // remove DOM nodes with .theme-effect
    qAll('.theme-effect').forEach(n => n.remove());
    // remove any per-theme class tweaks
    document.body.classList.remove('theme-anime-active');
    document.querySelectorAll('.select-container, .action-buttons button, .right-buttons button').forEach(el => {
      el.style.borderRadius = '';
    });
  }

  // ---------- utility fetch functions ----------
  ProjLib.fetchWithTimeout = function (url, opts = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...opts, signal: controller.signal })
      .then(resp => { clearTimeout(timer); return resp; })
      .catch(err => { clearTimeout(timer); throw err; });
  };

  ProjLib.fetchWithRetry = function (url, opts = {}, retries = 2, timeoutMs = 15000) {
    return ProjLib.fetchWithTimeout(url, opts, timeoutMs).catch(err => {
      if (retries > 0) return ProjLib.fetchWithRetry(url, opts, retries - 1, timeoutMs);
      throw err;
    });
  };

  // ---------- hub data + dropdowns ----------
  ProjLib.loadHubData = function (path = './hubData.json') {
    const cacheKey = 'hubDataCache_v1';
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try { const parsed = JSON.parse(cached); HUB_DATA = parsed; if (HUB_DATA.defaultHome) DEFAULT_HOME = HUB_DATA.defaultHome; } catch (e) {}
    }
    return ProjLib.fetchWithRetry(path, {}, 2, 10000)
      .then(resp => {
        if (!resp.ok) throw new Error('Failed to fetch hubData.json');
        return resp.json();
      })
      .then(data => {
        HUB_DATA = data;
        try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
        if (data.defaultHome) DEFAULT_HOME = data.defaultHome;
        return data;
      })
      .catch(() => HUB_DATA || { categories: [] });
  };

  ProjLib.populateDropdowns = function (data) {
    if (!data || !Array.isArray(data.categories)) return;
    data.categories.forEach(cat => {
      const select = $(cat.id);
      if (!select) return;
      select.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = cat.label || 'Select';
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);
      if (Array.isArray(cat.links)) {
        const frag = document.createDocumentFragment();
        cat.links.forEach(link => {
          if (!link || !link.url || !link.name) return;
          const opt = document.createElement('option');
          opt.value = link.url;
          opt.textContent = link.name;
          frag.appendChild(opt);
        });
        select.appendChild(frag);
      }
    });
  };

  // ---------- iframe loading with overlay ----------
  ProjLib.processLoadUrl = function (input) {
    let url = (input || '').trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      // if it contains a dot assume domain otherwise treat as search
      if (/\.\w{2,}/.test(url)) url = 'https://' + url;
      else url = 'https://swisscows.com/web?query=' + encodeURIComponent(url);
    }

    const frame = $('proxyFrame');
    const overlay = $('loadingOverlay');
    const idle = $('initialMessage');
    if (!frame) return;
    if (overlay) overlay.style.display = 'flex';
    if (idle) idle.style.display = 'none';

    // set src and conservative fallback
    let loaded = false;
    frame.src = url;

    frame.onload = function () {
      loaded = true;
      if (overlay) overlay.style.display = 'none';
    };
    frame.onerror = function () {
      loaded = true;
      if (overlay) overlay.style.display = 'none';
      if (idle) idle.style.display = '';
      ProjLib.notify('Failed to load iframe content.');
    };

    // fallback timeout -> hide overlay (likely cross-origin or slow)
    addTimeout(setTimeout(() => {
      if (!loaded && overlay) overlay.style.display = 'none';
    }, 4500));
  };

  // ---------- simple notifier ----------
  ProjLib.notify = function (msg) {
    const n = $('notification');
    if (!n) return;
    n.textContent = msg;
    n.classList.add('show');
    setTimeout(() => n.classList.remove('show'), 3500);
  };

  // ---------- Theme effects implementations ----------
  // these create small DOM nodes marked with .theme-effect so we can remove them easily

  function spawnKuromi(container) {
    const k = document.createElement('div');
    k.className = 'theme-effect kuromi-icon';
    // position inside container
    const r = container.getBoundingClientRect();
    k.style.left = (Math.random() * (r.width - 36)) + 'px';
    k.style.top = (Math.random() * (r.height - 36)) + 'px';
    container.appendChild(k);
    addTimeout(setTimeout(() => k.remove(), 1400));
  }

  function spawnTechScanline(container) {
    const line = document.createElement('div');
    line.className = 'theme-effect tech-scanline';
    const r = container.getBoundingClientRect();
    line.style.top = (Math.random() * (r.height)) + 'px';
    container.appendChild(line);
    addTimeout(setTimeout(() => line.remove(), 900));
  }

  function spawnComicPop(container, x, y) {
    const pop = document.createElement('div');
    pop.className = 'theme-effect comic-pop';
    const r = container.getBoundingClientRect();
    pop.style.left = (x - r.left) + 'px';
    pop.style.top = (y - r.top) + 'px';
    pop.textContent = ['POW','BAM','WHAM','ZING'][Math.floor(Math.random()*4)];
    container.appendChild(pop);
    addTimeout(setTimeout(() => pop.remove(), 900));
  }

  function addCyberOverlay(container) {
    const ov = document.createElement('div');
    ov.className = 'theme-effect cp-overlay';
    ov.style.inset = '0';
    container.appendChild(ov);
    // subtle flicker with interval
    const id = addInterval(setInterval(() => {
      ov.style.opacity = '0.08';
      addTimeout(setTimeout(() => ov.style.opacity = '0', 140));
    }, 1100));
    return id;
  }

  function spawnMatrixChar(container) {
    const ch = document.createElement('div');
    ch.className = 'theme-effect matrix-char';
    const r = container.getBoundingClientRect();
    ch.style.left = (Math.random() * (r.width - 12)) + 'px';
    ch.style.top = '-20px';
    ch.textContent = String.fromCharCode(33 + Math.floor(Math.random() * 94));
    container.appendChild(ch);
    // simple fall
    let top = -20;
    const move = setInterval(() => {
      top += 6;
      ch.style.top = top + 'px';
      if (top > r.height + 20) { clearInterval(move); ch.remove(); }
    }, 60);
    // record interval so clearAllEffects cleans it up
    addInterval(move);
  }

  function spawnAnimeParticle(container) {
    const p = document.createElement('div');
    p.className = 'theme-effect anime-particle';
    const r = container.getBoundingClientRect();
    p.style.left = (Math.random() * (r.width - 10)) + 'px';
    p.style.top = (r.height + 10) + 'px';
    container.appendChild(p);
    addTimeout(setTimeout(() => p.remove(), 1800));
  }

  // orchestrator: triggers effects per theme and records handles in EFFECTS
  function triggerThemeEffects(theme) {
    clearThemeEffects();
    const container = $('.console-container') || document.body;

    switch (theme) {
      case 'kuromi':
        // pop every ~900-1600ms
        EFFECTS.intervals.push(setInterval(() => spawnKuromi(container), 900 + Math.random() * 800));
        break;
      case 'tech':
        EFFECTS.intervals.push(setInterval(() => spawnTechScanline(container), 300 + Math.random() * 300));
        break;
      case 'dark':
        EFFECTS.intervals.push(setInterval(() => spawnTechScanline(container), 900 + Math.random() * 700));
        break;
      case 'comic':
        // on-click comic pops (add and track listener)
        const comicClick = (e) => spawnComicPop(container, e.clientX, e.clientY);
        addEffectListener(document, 'click', comicClick, false);
        break;
      case 'cyberpunk':
        addCyberOverlay(container);
        break;
      case 'geek':
        EFFECTS.intervals.push(setInterval(() => spawnMatrixChar(container), 140));
        break;
      case 'anime':
        EFFECTS.intervals.push(setInterval(() => spawnAnimeParticle(container), 420));
        // make UI rounder for anime
        document.querySelectorAll('.select-container, .action-buttons button, .right-buttons button').forEach(el => el.style.borderRadius = '12px');
        break;
      case 'minimal':
        // intentionally quiet
        break;
    }
  }

  // event listener helper tracked in EFFECTS.listeners for later removal (only for theme-generated listeners)
  function addEffectListener(target, ev, fn, opts) {
    target.addEventListener(ev, fn, opts);
    EFFECTS.listeners.push({ target, ev, fn, opts });
  }

  // ---------- theme API ----------
  ProjLib.applyTheme = function (theme) {
    // remove old theme classes
    THEME_LIST.forEach(t => document.body.classList.remove('theme-' + t));
    document.body.classList.add('theme-' + theme);
    triggerThemeEffects(theme);
    localStorage.setItem('theme', theme);
    const btn = $('toggleThemeBtn');
    if (btn) btn.textContent = 'Theme: ' + theme.charAt(0).toUpperCase() + theme.slice(1);
  };

  ProjLib.toggleTheme = function () {
    themeIndex = (themeIndex + 1) % THEME_LIST.length;
    ProjLib.applyTheme(THEME_LIST[themeIndex]);
  };

  // ---------- UI wiring (boot) ----------
  document.addEventListener('DOMContentLoaded', function () {
    // Initial theme (dark by default)
    let saved = localStorage.getItem('theme') || 'dark';
    if (!THEME_LIST.includes(saved)) saved = 'dark';
    themeIndex = THEME_LIST.indexOf(saved);
    ProjLib.applyTheme(saved);

    // Load hub data and populate dropdowns
    ProjLib.loadHubData('./hubData.json').then(data => {
      ProjLib.populateDropdowns(data);
      if (DEFAULT_HOME) ProjLib.processLoadUrl(DEFAULT_HOME);
      else if (data && data.defaultHome) ProjLib.processLoadUrl(data.defaultHome);
    }).catch(() => { /* ignore */ });

    // Dropdowns event delegation
    const ddGrid = q('.dropdowns-grid');
    if (ddGrid) ddGrid.addEventListener('change', function (ev) {
      const t = ev.target;
      if (t && t.tagName && t.tagName.toLowerCase() === 'select') {
        const url = t.value;
        if (url) ProjLib.processLoadUrl(url);
        // reset to placeholder after brief delay
        setTimeout(() => { t.selectedIndex = 0; }, 120);
      }
    });

    // Scanner toggle wiring
    const scannerBtn = $('scannerBtn');
    const scannerForm = $('proxyForm');
    const urlInput = $('urlInput');
    if (scannerForm) {
      scannerForm.classList.add('hidden');
      scannerForm.style.display = 'none';
    }
    if (scannerBtn && scannerForm) {
      scannerBtn.addEventListener('click', function () {
        const shown = scannerForm.style.display !== 'none' && !scannerForm.classList.contains('hidden');
        if (shown) {
          scannerForm.classList.add('hidden');
          scannerForm.style.display = 'none';
        } else {
          scannerForm.classList.remove('hidden');
          scannerForm.style.display = 'flex';
          if (urlInput) setTimeout(() => urlInput.focus(), 80);
        }
      });
      // submit
      scannerForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!urlInput) return;
        const v = urlInput.value && urlInput.value.trim();
        if (v) ProjLib.processLoadUrl(v);
        urlInput.value = '';
        scannerForm.classList.add('hidden');
        scannerForm.style.display = 'none';
      });
    }

    // Buttons: home, refresh, fullscreen
    $('homeBtn') && $('homeBtn').addEventListener('click', function () {
      const h = DEFAULT_HOME || (HUB_DATA && HUB_DATA.defaultHome);
      if (h) ProjLib.processLoadUrl(h);
      else ProjLib.notify('No home configured.');
    });
    $('refreshBtn') && $('refreshBtn').addEventListener('click', function () {
      const frame = $('proxyFrame');
      if (!frame) return;
      try { frame.contentWindow.location.reload(); }
      catch (e) { frame.src = frame.src; }
    });
    $('fullscreenBtn') && $('fullscreenBtn').addEventListener('click', function () {
      const frame = $('proxyFrame');
      if (!frame) return;
      if (frame.requestFullscreen) frame.requestFullscreen();
      else if (frame.webkitRequestFullscreen) frame.webkitRequestFullscreen();
    });

    // Theme button
    const themeBtn = $('toggleThemeBtn');
    if (themeBtn) themeBtn.addEventListener('click', ProjLib.toggleTheme);

    // iframe overlay hide on load/error as a safe fallback
    const frame = $('proxyFrame');
    if (frame) {
      frame.addEventListener('load', () => { $('loadingOverlay') && ($('loadingOverlay').style.display = 'none'); });
      frame.addEventListener('error', () => { $('loadingOverlay') && ($('loadingOverlay').style.display = 'none'); });
    }

    // ESC hides scanner
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        const sf = $('proxyForm');
        if (sf && !sf.classList.contains('hidden')) { sf.classList.add('hidden'); sf.style.display = 'none'; }
      }
    });

  });

  // expose a cleanup util for debugging (optional)
  ProjLib._cleanupThemeEffects = clearThemeEffects;

})(window.ProjLib = window.ProjLib || {});
