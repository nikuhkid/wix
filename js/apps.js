/* js/apps.js
   Full implementation: scanner, hub, iframe, dropdowns, and 8 themes with effects.
   - Matches index.html (proxyForm, proxyFrame, scannerBtn, toggleThemeBtn, dropdowns-grid selects)
   - Put hubData.json in same folder as index.html and serve over HTTP
*/

(function(projLib){
  'use strict';

  const THEME_LIST = ['dark','kuromi','comic','cyberpunk','geek','tech','anime','minimal'];
  let themeIndex = 0;
  let effectIntervals = {};

  function clearThemeEffects(){
    // wipe running intervals + overlays
    Object.values(effectIntervals).forEach(i=>clearInterval(i));
    effectIntervals = {};
    document.querySelectorAll('.theme-effect').forEach(el=>el.remove());
  }

  function spawnKuromi(){
    const el = document.createElement('div');
    el.className = 'kuromi-icon theme-effect';
    el.style.top = Math.random()*window.innerHeight+'px';
    el.style.left = Math.random()*window.innerWidth+'px';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),1500);
  }

  function spawnComicPop(){
    const el = document.createElement('div');
    el.className = 'comic-pop theme-effect';
    el.style.top = Math.random()*window.innerHeight+'px';
    el.style.left = Math.random()*window.innerWidth+'px';
    el.textContent = 'POW!';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),1000);
  }

  function spawnScanline(){
    const el = document.createElement('div');
    el.className = 'tech-scanline theme-effect';
    el.style.top = Math.random()*window.innerHeight+'px';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),800);
  }

  function spawnMatrixChar(){
    const chars = '01あカナギΩΨΣ';
    const el = document.createElement('div');
    el.className = 'matrix-char theme-effect';
    el.textContent = chars[Math.floor(Math.random()*chars.length)];
    el.style.left = Math.random()*window.innerWidth+'px';
    el.style.top = '-20px';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),3000);
  }

  function spawnAnimeParticle(){
    const el = document.createElement('div');
    el.className = 'anime-particle theme-effect';
    el.style.left = Math.random()*window.innerWidth+'px';
    el.style.top = window.innerHeight+'px';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),2000);
  }

  function triggerThemeEffects(theme){
    clearThemeEffects();

    if(theme==='kuromi'){
      effectIntervals.kuromi=setInterval(spawnKuromi,2500);
    }
    if(theme==='comic'){
      document.addEventListener('click',spawnComicPop);
      effectIntervals.comic = setInterval(()=>{},1000); // placeholder so clear works
    }
    if(theme==='cyberpunk'){
      const overlay=document.createElement('div');
      overlay.className='cp-overlay theme-effect';
      document.body.appendChild(overlay);
    }
    if(theme==='geek'){
      effectIntervals.geek=setInterval(spawnMatrixChar,150);
    }
    if(theme==='tech'){
      effectIntervals.tech=setInterval(spawnScanline,400);
    }
    if(theme==='anime'){
      effectIntervals.anime=setInterval(spawnAnimeParticle,500);
    }
  }

  projLib.applyTheme=function(mode){
    THEME_LIST.forEach(t=>document.body.classList.remove('theme-'+t));
    document.body.classList.add('theme-'+mode);
    triggerThemeEffects(mode);
  };

  projLib.toggleTheme=function(){
    themeIndex=(themeIndex+1)%THEME_LIST.length;
    const theme=THEME_LIST[themeIndex];
    projLib.applyTheme(theme);
    localStorage.setItem('theme',theme);
    const btn=document.getElementById('toggleThemeBtn');
    if(btn) btn.textContent='Theme: '+theme.charAt(0).toUpperCase()+theme.slice(1);
  };
  // ---------- State ----------
  let HUB_DATA = null;
  let DEFAULT_HOME = null;
  const THEME_LIST = ['dark','kuromi','comic','cyberpunk','geek','tech','anime','minimal'];
  let themeIndex = 0;

  // intervals/handles for cleanup
  const EFFECTS = {
    intervals: [],
    timeouts: []
  };

  // small helpers
  const $ = id => document.getElementById(id);
  const q = sel => document.querySelector(sel);
  const qAll = sel => Array.from(document.querySelectorAll(sel));

  function addInterval(i){ EFFECTS.intervals.push(i); return i; }
  function addTimeout(t){ EFFECTS.timeouts.push(t); return t; }

  function clearAllEffects(){
    EFFECTS.intervals.forEach(i => clearInterval(i));
    EFFECTS.intervals = [];
    EFFECTS.timeouts.forEach(t => clearTimeout(t));
    EFFECTS.timeouts = [];
    qAll('.theme-effect').forEach(n => n.remove());
    document.body.classList.remove('theme-anime-active');
    // reset per-theme style tweaks
    document.querySelectorAll('.select-container, .action-buttons button, .right-buttons button')
      .forEach(el => el.style.borderRadius = '');
  }

  // ---------- Utilities ----------
  ProjLib.isValidUrl = function (s) {
    try {
      const u = new URL(s.startsWith('http') ? s : 'https://' + s);
      return !!u.hostname && (u.hostname.includes('.') || u.hostname === 'localhost');
    } catch { return false; }
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

  // ---------- Hub data and dropdowns ----------
  ProjLib.loadHubData = function (path = './hubData.json') {
    return ProjLib.fetchWithRetry(path, {}, 2, 10000)
      .then(resp => resp.json())
      .then(data => {
        HUB_DATA = data;
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

    if (overlay) overlay.style.display = 'flex';
    const idle = $('initialMessage');
    if (idle) idle.style.display = 'none';

    frame.src = t;

    let loaded = false;
    frame.onload = () => {
      loaded = true;
      if (overlay) overlay.style.display = 'none';
    };
    frame.onerror = () => {
      loaded = true;
      if (overlay) overlay.style.display = 'none';
      if (idle) idle.style.display = '';
    };

    addTimeout(setTimeout(() => {
      if (!loaded && overlay) overlay.style.display = 'none';
    }, 4500));
  };

  // ---------- Theme system & effects ----------
  function applyTheme(theme) {
    THEME_LIST.forEach(t => document.body.classList.remove('theme-' + t));
    document.body.classList.add('theme-' + theme);
    localStorage.setItem('theme', theme);
  }

  function startKuromiEffect(container) {
    const url = 'https://upload.wikimedia.org/wikipedia/en/d/dc/Kuromi_icon.png';
    addInterval(setInterval(() => {
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
      addTimeout(setTimeout(() => k.style.opacity = '1', 20));
      addTimeout(setTimeout(() => k.style.opacity = '0', 1200));
      addTimeout(setTimeout(() => k.remove(), 1500));
    }, 480));
  }

  function startTechScanlines(container, color='rgba(255,255,255,0.06)') {
    addInterval(setInterval(() => {
      const line = document.createElement('div');
      line.className = 'theme-effect tech-scanline';
      line.style.position = 'absolute';
      line.style.left = '0';
      line.style.width = '100%';
      line.style.height = '1px';
      line.style.background = `linear-gradient(90deg, transparent, ${color}, transparent)`;
      line.style.top = Math.random() * container.offsetHeight + 'px';
      container.appendChild(line);
      addTimeout(setTimeout(() => line.remove(), 800));
    }, 400));
  }

  function startComicClicks(container) {
    container.addEventListener('click', function onClick(e) {
      const pop = document.createElement('div');
      pop.className = 'theme-effect comic-pop';
      pop.style.position = 'absolute';
      const rect = container.getBoundingClientRect();
      pop.style.left = (e.clientX - rect.left - 40) + 'px';
      pop.style.top = (e.clientY - rect.top - 40) + 'px';
      pop.style.width = '80px';
      pop.style.height = '80px';
      pop.style.border = '2px solid #fff';
      pop.style.borderRadius = '12px';
      pop.style.opacity = '0';
      pop.style.transition = 'transform 180ms, opacity 180ms';
      container.appendChild(pop);
      addTimeout(setTimeout(() => { pop.style.opacity = '1'; pop.style.transform = 'scale(1.05)'; }, 10));
      addTimeout(setTimeout(() => { pop.style.opacity = '0'; pop.style.transform = 'scale(1.1)'; }, 220));
      addTimeout(setTimeout(() => pop.remove(), 450));
    }, { once: true }); // only bind once per theme activation
    document.querySelectorAll('.select-container, .action-buttons button, .right-buttons button')
      .forEach(el => el.style.borderRadius = '12px');
  }

  function startCyberpunkFlicker(container) {
    const overlay = document.createElement('div');
    overlay.className = 'theme-effect cp-overlay';
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.mixBlendMode = 'screen';
    overlay.style.opacity = '0';
    container.appendChild(overlay);
    addInterval(setInterval(() => {
      overlay.style.opacity = '0.12';
      addTimeout(setTimeout(() => overlay.style.opacity = '0', 160));
    }, 1200));
  }

  function startGeekMatrix(container) {
    const layer = document.createElement('div');
    layer.className = 'theme-effect matrix-layer';
    layer.style.position = 'absolute';
    layer.style.inset = '0'; // cover full console
    layer.style.pointerEvents = 'none';
    layer.style.overflow = 'hidden';
    container.appendChild(layer);
    addInterval(setInterval(() => {
      const char = document.createElement('div');
      char.className = 'theme-effect matrix-char';
      char.style.position = 'absolute';
      char.style.left = Math.random() * (layer.offsetWidth - 12) + 'px';
      char.style.top = '-10px';
      char.style.fontFamily = 'monospace';
      char.style.fontSize = '12px';
      char.style.color = 'rgba(0,255,100,0.9)';
      char.textContent = String.fromCharCode(33 + Math.floor(Math.random() * 90));
      layer.appendChild(char);
      let top = -10;
      const move = setInterval(() => {
        top += 2;
        char.style.top = top + 'px';
        if (top > layer.offsetHeight) { clearInterval(move); char.remove(); }
      }, 40);
    }, 60));
  }

  function startAnimeParticles(container) {
    container.addEventListener('click', function onClick(e) {
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
      container.appendChild(p);
      addTimeout(setTimeout(() => { 
        p.style.transition = 'transform 420ms, opacity 420ms';
        p.style.transform = 'translateY(-30px) scale(1.6)';
        p.style.opacity = '0';
      }, 10));
      addTimeout(setTimeout(() => p.remove(), 520));
    }, { once: true });
    document.body.classList.add('theme-anime-active');
  }

  function triggerThemeEffects(theme) {
    clearAllEffects();
    const container = q('.console-container');
    if (!container) return;
    switch (theme) {
      case 'kuromi': startKuromiEffect(container); break;
      case 'tech': startTechScanlines(container); break;
      case 'dark': startTechScanlines(container,'rgba(0,255,0,0.05)'); break;
      case 'comic': startComicClicks(container); break;
      case 'cyberpunk': startCyberpunkFlicker(container); break;
      case 'geek': startGeekMatrix(container); break;
      case 'anime': startAnimeParticles(container); break;
      case 'minimal': break;
    }
  }

  ProjLib.applyTheme = function (theme) {
    applyTheme(theme);
    triggerThemeEffects(theme);
    const btn = $('toggleThemeBtn');
    if (btn) btn.textContent = 'Theme: ' + theme.charAt(0).toUpperCase() + theme.slice(1);
  };

  ProjLib.toggleTheme = function () {
    themeIndex = (themeIndex + 1) % THEME_LIST.length;
    ProjLib.applyTheme(THEME_LIST[themeIndex]);
  };

  // ---------- Boot & Event wiring ----------
  function wireDropdowns() {
    const grid = q('.dropdowns-grid');
    if (!grid) return;
    grid.addEventListener('change', ev => {
      const sel = ev.target;
      if (sel && sel.tagName.toLowerCase() === 'select' && sel.value) {
        ProjLib.processLoadUrl(sel.value);
        addTimeout(setTimeout(() => { sel.selectedIndex = 0; }, 120));
      }
    });
  }

  function wireScanner() {
    const scannerBtn = $('scannerBtn');
    const scannerForm = $('proxyForm');
    const urlInput = $('urlInput');
    if (!scannerBtn || !scannerForm) return;
    scannerForm.classList.add('hidden');
    scannerForm.style.display = 'none';
    scannerBtn.addEventListener('click', () => {
      const showing = scannerForm.style.display !== 'none';
      scannerForm.style.display = showing ? 'none' : 'flex';
      scannerForm.classList.toggle('hidden', showing);
      if (!showing && urlInput) setTimeout(() => urlInput.focus(), 50);
    });
    scannerForm.addEventListener('submit', e => {
      e.preventDefault();
      if (urlInput && urlInput.value.trim()) ProjLib.processLoadUrl(urlInput.value);
      urlInput.value = '';
      scannerForm.style.display = 'none';
      scannerForm.classList.add('hidden');
    });
  }

  function wireButtons() {
    $('homeBtn')?.addEventListener('click', () => {
      const h = DEFAULT_HOME || (HUB_DATA && HUB_DATA.defaultHome);
      if (h) ProjLib.processLoadUrl(h);
    });
    $('refreshBtn')?.addEventListener('click', () => {
      const frame = $('proxyFrame');
      if (!frame) return;
      try { frame.contentWindow.location.reload(); }
      catch { frame.src = frame.src; }
    });
    $('fullscreenBtn')?.addEventListener('click', () => {
      const frame = $('proxyFrame');
      if (!frame) return;
      if (frame.requestFullscreen) frame.requestFullscreen();
    });
    $('toggleThemeBtn')?.addEventListener('click', () => ProjLib.toggleTheme());
  }

  document.addEventListener('DOMContentLoaded', function () {
    let theme = localStorage.getItem('theme') || 'dark';
    if (!THEME_LIST.includes(theme)) theme = 'dark';
    themeIndex = THEME_LIST.indexOf(theme);
    ProjLib.applyTheme(theme);

    ProjLib.loadHubData('./hubData.json').then(data => {
      ProjLib.populateDropdowns(data);
      if (DEFAULT_HOME) ProjLib.processLoadUrl(DEFAULT_HOME);
    });

    wireDropdowns();
    wireScanner();
    wireButtons();
  });

})(window.ProjLib = window.ProjLib || {});
