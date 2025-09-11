/* js/apps.js
   Full implementation: scanner, hub, iframe, ticker, dropdowns, and 8 themes with effects.
   - Matches index.html (proxyForm, proxyFrame, scannerBtn, toggleThemeBtn, dropdowns-grid selects)
   - Put hubData.json in same folder as index.html and serve over HTTP
*/

(function (ProjLib) {
  'use strict';

  // ---------- State ----------
  let HUB_DATA = null;
  let DEFAULT_HOME = null;
  const THEME_LIST = ['dark','kuromi','comic','cyberpunk','geek','tech','anime','minimal'];
  let themeIndex = 0;

  // intervals/handles for cleanup
  const EFFECTS = {
    intervals: [],
    timeouts: [],
    listeners: []
  };

  // small helpers
  const $ = id => document.getElementById(id);
  const q = sel => document.querySelector(sel);
  const qAll = sel => Array.from(document.querySelectorAll(sel));

  function addInterval(i){ EFFECTS.intervals.push(i); return i; }
  function addTimeout(t){ EFFECTS.timeouts.push(t); return t; }
  function addListener(target, ev, fn, opts){ target.addEventListener(ev, fn, opts); EFFECTS.listeners.push({ target, ev, fn, opts }); }

  function clearAllEffects(){
    // clear intervals
    EFFECTS.intervals.forEach(i => clearInterval(i));
    EFFECTS.intervals = [];
    // clear timeouts
    EFFECTS.timeouts.forEach(t => clearTimeout(t));
    EFFECTS.timeouts = [];
    // remove listeners
    EFFECTS.listeners.forEach(l => {
      try { l.target.removeEventListener(l.ev, l.fn, l.opts); } catch(e){}
    });
    EFFECTS.listeners = [];
    // remove DOM nodes with .theme-effect attribute
    qAll('.theme-effect').forEach(n => n.remove());
    // remove theme specific classes that may remain
    qAll('.comic-pop-active').forEach(n => n.classList.remove('comic-pop-active'));
    document.body.classList.remove('theme-anime-active');
  }

  // ---------- Utilities ----------
  ProjLib.isValidUrl = function (s) {
    try {
      const u = new URL(s.startsWith('http') ? s : 'https://' + s);
      return !!u.hostname && (u.hostname.includes('.') || u.hostname === 'localhost');
    } catch (e) {
      return false;
    }
  };

  ProjLib.sanitizeText = function (txt) {
    const d = document.createElement('div');
    d.textContent = txt;
    return d.innerHTML;
  };

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

  // ---------- RSS / Ticker ----------
  ProjLib.fetchRSSFeed = function (feedUrl, cacheMs = 600000) {
    const key = 'rssFeedCache_' + feedUrl;
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < cacheMs) return Promise.resolve(parsed.data);
      } catch (e) { /* ignore */ }
    }
    return ProjLib.fetchWithRetry(feedUrl, {}, 2, 12000)
      .then(resp => {
        if (!resp.ok) throw new Error('Network response not ok');
        return resp.text();
      })
      .then(data => {
        try { localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data })); } catch (e) {}
        return data;
      });
  };

  ProjLib.updateTicker = function () {
    const tickerEl = q('.ticker');
    if (!tickerEl) return;
    ProjLib.fetchRSSFeed('https://www.rtp.pt/noticias/rss/mundo')
      .then(xmlStr => {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlStr, 'text/xml');
        const items = xml.getElementsByTagName('item');
        let html = '';
        for (let i = 0; i < items.length; i++) {
          const title = items[i].getElementsByTagName('title')[0];
          const link = items[i].getElementsByTagName('link')[0];
          if (title && link) {
            const safeTitle = ProjLib.sanitizeText(title.textContent);
            html += `<a href="${link.textContent}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;margin-right:20px;">${safeTitle}</a> | `;
          }
        }
        if (html.endsWith(' | ')) html = html.slice(0, -3);
        tickerEl.innerHTML = html || '[No items]';
        const containerWidth = q('.ticker-container').offsetWidth || 300;
        const contentWidth = tickerEl.scrollWidth || containerWidth;
        if (contentWidth > containerWidth) {
          const dur = Math.max(10, Math.round(contentWidth / 50));
          tickerEl.style.animation = `ticker ${dur}s linear infinite`;
        } else {
          tickerEl.style.animation = 'none';
          tickerEl.style.transform = 'translateX(0)';
        }
      })
      .catch(() => { tickerEl.innerText = 'Failed to load news feed.'; });
  };

  // ---------- Hub data and dropdowns ----------
  ProjLib.loadHubData = function (path = './hubData.json') {
    const cacheKey = 'hubDataCache';
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        HUB_DATA = JSON.parse(cached);
        if (HUB_DATA && HUB_DATA.defaultHome) DEFAULT_HOME = HUB_DATA.defaultHome;
      } catch (e) { /* ignore */ }
    }
    return ProjLib.fetchWithRetry(path, {}, 2, 10000)
      .then(resp => { if (!resp.ok) throw new Error('Bad hub fetch'); return resp.json(); })
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
      const sel = $(cat.id);
      if (!sel) return;
      sel.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = cat.label || 'Select';
      placeholder.disabled = true;
      placeholder.selected = true;
      sel.appendChild(placeholder);
      if (Array.isArray(cat.links)) {
        cat.links.forEach(link => {
          if (link && link.url && link.name) {
            const opt = document.createElement('option');
            opt.value = link.url;
            opt.textContent = link.name;
            sel.appendChild(opt);
          }
        });
      }
    });
  };

  // ---------- Iframe loading + embed fallback ----------
  ProjLib.processLoadUrl = function (input) {
    let t = (input || '').trim();
    if (!t) return;
    if (!t.startsWith('http://') && !t.startsWith('https://')) {
      if (/\.\w{2,}/.test(t)) t = 'https://' + t;
      else t = 'https://swisscows.com/web?query=' + encodeURIComponent(t);
    }

    const frame = $('proxyFrame');
    const overlay = $('loadingOverlay');
    if (!frame) return;

    // show overlay
    if (overlay) overlay.style.display = 'flex';
    // hide idle
    const idle = $('initialMessage');
    if (idle) idle.style.display = 'none';

    // set src
    frame.src = t;

    // conservative embed detection: if onload not fired within timeout, show message (but do not assume failure due to cross-origin)
    let loaded = false;
    const onload = () => {
      loaded = true;
      if (overlay) overlay.style.display = 'none';
      // try to read current location if same-origin (may fail)
      try { $('currentUrl') && ($('currentUrl').value = frame.contentWindow.location.href); } catch (e) {}
    };
    const onerror = () => {
      loaded = true;
      if (overlay) overlay.style.display = 'none';
      console.warn('Frame onerror for', t);
      // show user-friendly idle back or notification
      if (idle) idle.style.display = '';
      // leave frame blank
    };

    frame.onload = onload;
    frame.onerror = onerror;

    // fallback timer -> if not loaded in 4500ms, hide overlay (assume cross-origin or slow)
    addTimeout(setTimeout(() => {
      if (!loaded && overlay) overlay.style.display = 'none';
    }, 4500));
  };

  // ---------- Theme system & effects ----------
  function applyTheme(theme) {
    // clear existing theme classes from body
    THEME_LIST.forEach(t => document.body.classList.remove('theme-' + t));
    document.body.classList.add('theme-' + theme);
    localStorage.setItem('theme', theme);
  }

  function startKuromiEffect(container) {
    // small Kuromi pops using a Wikimedia Kuromi icon (publicly accessible)
    const url = 'https://upload.wikimedia.org/wikipedia/en/d/dc/Kuromi_icon.png';
    const interval = addInterval(setInterval(() => {
      const k = document.createElement('div');
      k.className = 'theme-effect kuromi-icon';
      k.style.position = 'absolute';
      k.style.left = Math.random() * (container.offsetWidth - 28) + 'px';
      k.style.top = Math.random() * (container.offsetHeight - 28) + 'px';
      k.style.width = '24px';
      k.style.height = '24px';
      k.style.backgroundImage = `url("${url}")`;
      k.style.backgroundSize = 'contain';
      k.style.opacity = '0';
      k.style.transition = 'opacity 120ms ease';
      container.appendChild(k);
      // fade in and then out
      addTimeout(setTimeout(() => k.style.opacity = '1', 20));
      addTimeout(setTimeout(() => k.style.opacity = '0', 1200));
      addTimeout(setTimeout(() => k.remove(), 1500));
    }, 480), 480);
    return interval;
  }

  function startTechScanlines(container) {
    const interval = addInterval(setInterval(() => {
      const line = document.createElement('div');
      line.className = 'theme-effect tech-scanline';
      line.style.position = 'absolute';
      line.style.left = '-10%';
      line.style.width = '120%';
      line.style.height = '1px';
      line.style.background = 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)';
      line.style.top = Math.random() * container.offsetHeight + 'px';
      container.appendChild(line);
      addTimeout(setTimeout(() => line.remove(), 800), 800);
    }, 380), 380);
    return interval;
  }

  function startDarkScanlines(container) {
    // much subtler and less frequent than tech
    const interval = addInterval(setInterval(() => {
      const line = document.createElement('div');
      line.className = 'theme-effect tech-scanline';
      line.style.position = 'absolute';
      line.style.left = '-10%';
      line.style.width = '120%';
      line.style.height = '1px';
      line.style.background = 'linear-gradient(90deg, transparent, rgba(0,255,0,0.05), transparent)';
      line.style.top = Math.random() * container.offsetHeight + 'px';
      container.appendChild(line);
      addTimeout(setTimeout(() => line.remove(), 900), 900);
    }, 900), 900);
    return interval;
  }

  function startComicClicks(container) {
    // clicking the console generates a short "comic-pop" at click point
    function onClick(e) {
      const pop = document.createElement('div');
      pop.className = 'theme-effect comic-pop';
      pop.style.position = 'absolute';
      const rect = container.getBoundingClientRect();
      pop.style.left = (e.clientX - rect.left - 40) + 'px';
      pop.style.top = (e.clientY - rect.top - 40) + 'px';
      pop.style.width = '80px';
      pop.style.height = '80px';
      pop.style.pointerEvents = 'none';
      pop.style.backgroundImage = 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9) 0%, transparent 40%), radial-gradient(circle at 70% 70%, rgba(255,200,0,0.9) 0%, transparent 40%)';
      pop.style.border = '2px solid #fff';
      pop.style.borderRadius = '12px';
      pop.style.transform = 'scale(0.6)';
      pop.style.opacity = '0';
      pop.style.transition = 'transform 180ms cubic-bezier(.2,.8,.2,1), opacity 180ms';
      container.appendChild(pop);
      addTimeout(setTimeout(() => { pop.style.opacity = '1'; pop.style.transform = 'scale(1.05)'; }, 10), 10);
      addTimeout(setTimeout(() => { pop.style.opacity = '0'; pop.style.transform = 'scale(1.1)'; }, 220), 220);
      addTimeout(setTimeout(() => pop.remove(), 450), 450);
    }
    addListener(container, 'click', onClick);
    return onClick;
  }

  function startCyberpunkFlicker(container) {
    // subtle flicker on text and buttons via overlay elements toggled periodically
    const overlay = document.createElement('div');
    overlay.className = 'theme-effect cp-overlay';
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.mixBlendMode = 'screen';
    overlay.style.opacity = '0';
    container.appendChild(overlay);

    const interval = addInterval(setInterval(() => {
      overlay.style.opacity = '0.12';
      addTimeout(setTimeout(() => overlay.style.opacity = '0', 160), 160);
    }, 1200), 1200);
    return interval;
  }

  function startGeekMatrix(container) {
    // create a lightweight falling characters effect behind content
    const matrixLayer = document.createElement('div');
    matrixLayer.className = 'theme-effect matrix-layer';
    matrixLayer.style.position = 'absolute';
    matrixLayer.style.inset = '0';
    matrixLayer.style.pointerEvents = 'none';
    matrixLayer.style.overflow = 'hidden';
    container.appendChild(matrixLayer);

    const interval = addInterval(setInterval(() => {
      const char = document.createElement('div');
      char.className = 'theme-effect matrix-char';
      char.style.position = 'absolute';
      char.style.left = Math.random() * (container.offsetWidth - 12) + 'px';
      char.style.top = '-10px';
      char.style.fontFamily = 'monospace';
      char.style.fontSize = '12px';
      char.style.color = 'rgba(0,255,100,0.9)';
      const code = 33 + Math.floor(Math.random() * 90);
      char.textContent = String.fromCharCode(code);
      matrixLayer.appendChild(char);
      const speed = 10 + Math.random() * 40;
      let top = -10;
      const move = setInterval(() => {
        top += speed / 40;
        char.style.top = top + 'px';
        if (top > container.offsetHeight + 20) {
          clearInterval(move);
          char.remove();
        }
      }, 40);
      // cleanup move if left behind
      addTimeout(setTimeout(() => { if (char.parentNode) char.remove(); }, 6000), 6000);
    }, 50), 50);
    return interval;
  }

  function startAnimeParticles(container) {
    function onClick(e) {
      const p = document.createElement('div');
      p.className = 'theme-effect anime-particle';
      p.style.position = 'absolute';
      const rect = container.getBoundingClientRect();
      p.style.left = (e.clientX - rect.left) + 'px';
      p.style.top = (e.clientY - rect.top) + 'px';
      p.style.width = '8px';
      p.style.height = '8px';
      p.style.borderRadius = '50%';
      p.style.background = 'radial-gradient(circle, #ffd6f2 0%, #ff9ad5 60%)';
      p.style.opacity = '1';
      p.style.transform = 'translate(-50%,-50%) scale(1)';
      p.style.pointerEvents = 'none';
      container.appendChild(p);
      // animate out
      addTimeout(setTimeout(() => { p.style.transition = 'transform 420ms ease, opacity 420ms ease'; p.style.transform = `translate(-50%,-50%) translateY(-30px) scale(1.6)`; p.style.opacity = '0'; }, 10), 10);
      addTimeout(setTimeout(() => p.remove(), 520), 520);
    }
    addListener(container, 'click', onClick);
    return onClick;
  }

  // theme manager
  function triggerThemeEffects(theme) {
    clearAllEffects(); // clear previous
    const container = q('.console-container');
    if (!container) return;

    switch (theme) {
      case 'kuromi':
        startKuromiEffect(container);
        break;
      case 'tech':
        startTechScanlines(container);
        break;
      case 'dark':
        startDarkScanlines(container);
        break;
      case 'comic':
        startComicClicks(container);
        // slightly round UI for comic
        document.querySelectorAll('.select-container, .action-buttons button, .right-buttons button').forEach(el => el.style.borderRadius = '12px');
        break;
      case 'cyberpunk':
        startCyberpunkFlicker(container);
        break;
      case 'geek':
        startGeekMatrix(container);
        break;
      case 'anime':
        // rounded elements
        document.body.classList.add('theme-anime-active');
        startAnimeParticles(container);
        break;
      case 'minimal':
        // minimal is intentionally quiet; subtle hover handled by CSS if present
        break;
      default:
        break;
    }
  }

  ProjLib.applyTheme = function (theme) {
    applyTheme(theme);
    triggerThemeEffects(theme);
    // update button text
    const btn = $('toggleThemeBtn');
    if (btn) btn.textContent = 'Theme: ' + theme.charAt(0).toUpperCase() + theme.slice(1);
  };

  ProjLib.toggleTheme = function () {
    themeIndex = (themeIndex + 1) % THEME_LIST.length;
    const theme = THEME_LIST[themeIndex];
    ProjLib.applyTheme(theme);
  };

  // ---------- Boot & Event wiring ----------
  function wireDropdowns() {
    const grid = q('.dropdowns-grid');
    if (!grid) return;
    // event delegation
    addListener(grid, 'change', function (ev) {
      const sel = ev.target;
      if (!sel || sel.tagName.toLowerCase() !== 'select') return;
      const val = sel.value;
      if (val) {
        ProjLib.processLoadUrl(val);
        // reset after short delay so UI shows selection momentarily
        addTimeout(setTimeout(() => { sel.selectedIndex = 0; }, 120), 120);
      }
    });
  }

  function wireScanner() {
    const scannerBtn = $('scannerBtn');
    const scannerForm = $('proxyForm');
    const urlInput = $('urlInput');
    if (!scannerBtn || !scannerForm) return;
    // ensure hidden initially
    scannerForm.classList.add('hidden');
    scannerForm.style.display = 'none';
    // toggle
    scannerBtn.addEventListener('click', () => {
      const showing = !scannerForm.classList.contains('hidden') && scannerForm.style.display !== 'none';
      if (showing) {
        scannerForm.classList.add('hidden');
        scannerForm.style.display = 'none';
      } else {
        scannerForm.classList.remove('hidden');
        scannerForm.style.display = 'flex';
        if (urlInput) setTimeout(() => urlInput.focus(), 50);
      }
    });
    // submit
    addListener(scannerForm, 'submit', function (e) {
      e.preventDefault();
      if (!urlInput) return;
      const v = urlInput.value && urlInput.value.trim();
      if (v) ProjLib.processLoadUrl(v);
      urlInput.value = '';
      // hide after submit
      scannerForm.classList.add('hidden');
      scannerForm.style.display = 'none';
    });
  }

  function wireButtons() {
    const home = $('homeBtn');
    const refresh = $('refreshBtn');
    const fullscreen = $('fullscreenBtn');
    const themeBtn = $('toggleThemeBtn');

    if (home) home.addEventListener('click', () => {
      const h = DEFAULT_HOME || (HUB_DATA && HUB_DATA.defaultHome) || '';
      if (h) ProjLib.processLoadUrl(h);
      else console.warn('No home configured.');
    });

    if (refresh) refresh.addEventListener('click', () => {
      const frame = $('proxyFrame');
      if (!frame) return;
      try {
        frame.contentWindow.location.reload();
      } catch (e) {
        // cross-origin fallback
        frame.src = frame.src;
      }
    });

    if (fullscreen) fullscreen.addEventListener('click', () => {
      const frame = $('proxyFrame');
      if (!frame) return;
      if (frame.requestFullscreen) frame.requestFullscreen();
      else if (frame.webkitRequestFullscreen) frame.webkitRequestFullscreen();
      else if (frame.mozRequestFullScreen) frame.mozRequestFullScreen();
      else if (frame.msRequestFullscreen) frame.msRequestFullscreen();
    });

    if (themeBtn) addListener(themeBtn, 'click', () => ProjLib.toggleTheme());
  }

  // ---------- Initialization ----------
  document.addEventListener('DOMContentLoaded', function () {
    // initial theme
    let theme = localStorage.getItem('theme') || 'dark';
    if (!THEME_LIST.includes(theme)) theme = 'dark';
    themeIndex = THEME_LIST.indexOf(theme);
    ProjLib.applyTheme(theme);

    // Ticker
    ProjLib.updateTicker();
    addInterval(setInterval(ProjLib.updateTicker, 600000));

    // Load hub data and populate dropdowns
    ProjLib.loadHubData('./hubData.json').then(data => {
      try { ProjLib.populateDropdowns(data); } catch (e) { console.warn('populateDropdowns failed', e); }
      // load home if set
      if (DEFAULT_HOME) ProjLib.processLoadUrl(DEFAULT_HOME);
      else if (data && data.defaultHome) ProjLib.processLoadUrl(data.defaultHome);
    }).catch(err => { console.warn('hub load failed', err); });

    // wire UI
    wireDropdowns();
    wireScanner();
    wireButtons();

    // keep a hidden input currentUrl for debugging (optional)
    const cur = document.createElement('input');
    cur.id = 'currentUrl';
    cur.type = 'text';
    cur.readOnly = true;
    cur.style.display = 'none';
    document.body.appendChild(cur);

    // accessibility: ESC hides scanner
    addListener(document, 'keydown', (ev) => {
      if (ev.key === 'Escape') {
        const sf = $('proxyForm');
        if (sf && !sf.classList.contains('hidden')) { sf.classList.add('hidden'); sf.style.display = 'none'; }
      }
    });

    // ensure iframe overlay hide on unload/error
    const frame = $('proxyFrame');
    if (frame) {
      frame.addEventListener('load', () => {
        $('loadingOverlay') && ($('loadingOverlay').style.display = 'none');
      });
      frame.addEventListener('error', () => {
        $('loadingOverlay') && ($('loadingOverlay').style.display = 'none');
      });
    }
  });

  // expose cleanup for debugging (optional)
  ProjLib._internalCleanup = clearAllEffects;

})(window.ProjLib = window.ProjLib || {});
