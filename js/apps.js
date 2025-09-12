/* ===================================================================
   apps.js - canonical main app file for ProjLib Control Node [BETA]
   - Do not rename this file (apps.js) — index.html expects it.
   - Do not change the project title in index.html
   - This file wires UI, themes, hubData.json, iframe, and effects.
   =================================================================== */

(function(Pro jLib){
  'use strict';

  // ---------- Config / State ----------
  const THEME_LIST = ['dark','glitch','matrix','kuromi','comic','anime','cyberpunk','minimal'];
  let themeIndex = 0;
  let HUB_DATA = null;
  let DEFAULT_HOME = null;

  // Effect trackers (so we can clean on theme switch)
  let kuromiInterval = null;
  let comicClickHandler = null;
  let matrixInterval = null;
  let glitchInterval = null;
  let animeMouseHandler = null;
  let cpInterval = null;

  // ---------- Utilities ----------
  function el(id){ return document.getElementById(id); }
  function qs(sel){ return document.querySelector(sel); }
  function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

  function sanitizeText(s){
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function notify(msg){
    const n = el('notification');
    if(!n) return;
    n.textContent = msg;
    n.classList.add('show');
    clearTimeout(n._t);
    n._t = setTimeout(()=>n.classList.remove('show'), 3000);
  }

  // ---------- Hub loading & dropdown population ----------
  async function loadHub(path='./hubData.json'){
    try{
      const r = await fetch(path);
      if(!r.ok) throw new Error('fetch failed');
      const data = await r.json();
      HUB_DATA = data;
      if(typeof data.defaultHome === 'string' && data.defaultHome) DEFAULT_HOME = data.defaultHome;
      populateDropdowns(data);
      if(DEFAULT_HOME) processLoadUrl(DEFAULT_HOME);
    } catch(err){
      console.warn('Could not load hubData.json', err);
      notify('Could not load hubData.json');
    }
  }

  function populateDropdowns(data){
    if(!data || !Array.isArray(data.categories)) return;
    data.categories.forEach(cat => {
      const select = el(cat.id);
      if(!select) return;
      // clear
      select.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = cat.label || 'Select';
      select.appendChild(placeholder);
      if(Array.isArray(cat.links)){
        cat.links.forEach(link=>{
          if(!link || !link.url || !link.name) return;
          const opt = document.createElement('option');
          opt.value = link.url;
          opt.textContent = link.name;
          select.appendChild(opt);
        });
      }
      // ensure change handler
      select.onchange = (ev)=>{
        const v = ev.target.value;
        if(v) processLoadUrl(v);
        ev.target.selectedIndex = 0;
      };
    });
  }

  // ---------- Iframe loader ----------
  function processLoadUrl(raw){
    if(!raw) return;
    let t = String(raw).trim();
    if(!/^https?:\/\//i.test(t)){
      if(/\.\w{2,}/.test(t)) t = 'https://' + t;
      else t = 'https://swisscows.com/web?query=' + encodeURIComponent(t);
    }

    const frame = el('proxyFrame');
    if(!frame) return;
    const overlay = el('loadingOverlay');

    try { el('initialMessage').style.display='none'; } catch(e){}

    if(overlay) overlay.style.display='flex';
    frame.onload = function(){ if(overlay) overlay.style.display='none'; };
    frame.onerror = function(){ if(overlay) overlay.style.display='none'; notify('Failed to load content (embedding blocked?).'); };

    frame.setAttribute('referrerpolicy','no-referrer');
    frame.setAttribute('allowfullscreen','true');
    frame.src = t;
  }

  // ---------- Theme management & per-theme effects ----------
  function applyTheme(theme){
    // remove old theme classes
    THEME_LIST.forEach(t => document.body.classList.remove('theme-'+t));
    document.body.classList.add('theme-'+theme);
    // cleanup any running effects
    cleanupThemeEffects();
    // start new theme effects where needed
    switch(theme){
      case 'kuromi': startKuromi(); break;
      case 'comic': startComic(); break;
      case 'matrix': startMatrix(); break;
      case 'glitch': startGlitch(); break;
      case 'anime': startAnime(); break;
      case 'cyberpunk': startCyberpunk(); break;
      default: /* dark/minimal: no JS effects */ break;
    }
    // persist
    localStorage.setItem('projlib_theme', theme);
    // update button label
    const btn = el('toggleThemeBtn');
    if(btn) btn.textContent = 'Theme: ' + theme.charAt(0).toUpperCase() + theme.slice(1);
  }

  function toggleTheme(){
    themeIndex = (themeIndex + 1) % THEME_LIST.length;
    applyTheme(THEME_LIST[themeIndex]);
  }

  function cleanupThemeEffects(){
    // kuromi
    if(kuromiInterval){ clearInterval(kuromiInterval); kuromiInterval = null; }
    qsa('.kuromi-sprite').forEach(n => n.remove());
    // comic
    if(comicClickHandler) { document.removeEventListener('click', comicClickHandler); comicClickHandler = null; }
    qsa('.comic-sprite').forEach(n => n.remove());
    // matrix
    if(matrixInterval){ clearInterval(matrixInterval); matrixInterval = null; }
    qsa('.matrix-char').forEach(n=>n.remove());
    // glitch
    if(glitchInterval){ clearInterval(glitchInterval); glitchInterval = null; qsa('.glitch-elem').forEach(n=>n.remove()); }
    // anime
    if(animeMouseHandler){ document.removeEventListener('mousemove', animeMouseHandler); animeMouseHandler = null; qsa('.anime-particle').forEach(n=>n.remove()); }
    // cyberpunk
    if(cpInterval){ clearInterval(cpInterval); cpInterval=null; qsa('.cp-ov').forEach(n=>n.remove()); }
  }

  // ---------- Kuromi ----------
  function startKuromi(){
    const container = document.querySelector('.console-container') || document.body;
    function spawn(){
      const rect = container.getBoundingClientRect();
      const img = document.createElement('img');
      img.src = 'assets/kuromi.png';
      img.className = 'kuromi-sprite';
      img.style.position = 'absolute';
      img.style.width = '100px';
      img.style.height = '100px';
      // keep inside container boundaries
      const left = Math.max(8, Math.floor(Math.random() * Math.max(1, rect.width - 100)));
      const top  = Math.max(8, Math.floor(Math.random() * Math.max(1, rect.height - 100)));
      img.style.left = left + 'px';
      img.style.top  = top + 'px';
      img.style.opacity = '1';
      container.appendChild(img);
      // fade out
      setTimeout(()=> { img.classList.add('fade-out'); setTimeout(()=> img.remove(), 700); }, 2000);
    }
    spawn(); // immediate
    kuromiInterval = setInterval(spawn, 4200);
  }

  // ---------- Comic ----------
  function startComic(){
    comicClickHandler = function(e){
      // avoid adding when clicking UI controls
      if(e.target.closest('.control-btn') || e.target.closest('.select-container') || e.target.closest('.scanner')) return;
      const assets = ['pow.png','zap.png','splash.png'];
      const sel = assets[Math.floor(Math.random()*assets.length)];
      const img = document.createElement('img');
      img.src = 'assets/' + sel;
      img.className = 'comic-sprite';
      img.style.position = 'fixed';
      img.style.width = '100px';
      img.style.height = '100px';
      img.style.left = (e.clientX - 50) + 'px';
      img.style.top = (e.clientY - 50) + 'px';
      img.style.pointerEvents = 'none';
      document.body.appendChild(img);
      // animate & remove
      setTimeout(()=>{ img.classList.add('fade-out'); setTimeout(()=> img.remove(),400); }, 650);
    };
    document.addEventListener('click', comicClickHandler);
  }

  // ---------- Matrix (example) ----------
  function startMatrix(){
    const container = document.querySelector('.console-container') || document.body;
    function spawnChar(){
      const rect = container.getBoundingClientRect();
      const c = document.createElement('div');
      c.className = 'matrix-char';
      c.style.position='absolute';
      c.style.left = Math.floor(Math.random() * Math.max(1, rect.width - 10)) + 'px';
      c.style.top = '-20px';
      c.style.color = '#0f0';
      c.style.fontFamily = 'monospace';
      c.style.fontSize = '14px';
      c.textContent = String.fromCharCode(33 + Math.floor(Math.random()*90));
      container.appendChild(c);
      let top = -20;
      const move = setInterval(()=> {
        top += 6;
        c.style.top = top + 'px';
        if(top > rect.height + 30){ clearInterval(move); c.remove(); }
      }, 60);
    }
    matrixInterval = setInterval(spawnChar, 120);
  }

  // ---------- Glitch ----------
  function startGlitch(){
    const container = document.querySelector('.console-container') || document.body;
    glitchInterval = setInterval(()=>{
      const g = document.createElement('div');
      g.className = 'glitch-elem';
      g.style.position='absolute';
      g.style.left = Math.random()*100 + '%';
      g.style.top = Math.random()*100 + '%';
      g.style.width = '6px';
      g.style.height = (10 + Math.random()*40) + 'px';
      g.style.background = ['#ff00ff','#00ffff','#ffffff'][Math.floor(Math.random()*3)];
      g.style.opacity = '0.12';
      g.style.pointerEvents = 'none';
      container.appendChild(g);
      setTimeout(()=>g.remove(), 300 + Math.random()*400);
    }, 90);
  }

  // ---------- Anime (mouse trail) ----------
  function startAnime(){
    animeMouseHandler = function(e){
      const p = document.createElement('div');
      p.className = 'anime-particle';
      p.style.position = 'fixed';
      p.style.left = (e.clientX - 6) + 'px';
      p.style.top = (e.clientY - 6) + 'px';
      p.style.width = '12px';
      p.style.height = '12px';
      p.style.borderRadius = '50%';
      p.style.background = 'radial-gradient(circle,#ffd6f2,#ff9ad5)';
      p.style.opacity = '0.9';
      p.style.pointerEvents = 'none';
      document.body.appendChild(p);
      setTimeout(()=> { p.style.opacity='0'; setTimeout(()=> p.remove(), 350); }, 450);
    };
    document.addEventListener('mousemove', animeMouseHandler);
  }

  // ---------- Cyberpunk (subtle overlay flicker) ----------
  function startCyberpunk(){
    const container = document.querySelector('.console-container') || document.body;
    const ov = document.createElement('div');
    ov.className = 'cp-ov';
    ov.style.position='absolute';
    ov.style.inset='0';
    ov.style.pointerEvents='none';
    ov.style.zIndex='999';
    ov.style.background = 'linear-gradient(90deg, rgba(255,0,255,0.06), rgba(0,255,255,0.06))';
    ov.style.opacity='0';
    container.appendChild(ov);
    cpInterval = setInterval(()=> {
      ov.style.opacity = '0.12';
      setTimeout(()=> ov.style.opacity='0', 100);
    }, 800);
  }

  // ---------- Boot / UI wiring ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    // Restore theme from storage
    const saved = localStorage.getItem('projlib_theme') || 'dark';
    themeIndex = Math.max(0, THEME_LIST.indexOf(saved));
    if(themeIndex === -1) themeIndex = 0;
    applyTheme(THEME_LIST[themeIndex]);

    // Theme button
    const themeBtn = el('themeBtn') || el('toggleThemeBtn'); // both names tolerated
    if(themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // Scanner wiring
    const scannerBtn = el('scannerBtn');
    const scannerForm = el('scannerForm');
    const urlInput = el('urlInput');
    if(scannerBtn && scannerForm){
      scannerBtn.addEventListener('click', ()=>{
        scannerForm.classList.toggle('hidden');
        if(!scannerForm.classList.contains('hidden')) urlInput && urlInput.focus();
      });
      scannerForm.addEventListener('submit', function(e){
        e.preventDefault();
        const v = urlInput && urlInput.value && urlInput.value.trim();
        if(v) processLoadUrl(v);
        // clear and hide
        if(urlInput) urlInput.value = '';
        scannerForm.classList.add('hidden');
      });
    }

    // Home/Refresh/Back/Forward/Fullscreen
    el('homeBtn') && el('homeBtn').addEventListener('click', ()=> { if(DEFAULT_HOME) processLoadUrl(DEFAULT_HOME); else notify('No home configured.'); });
    el('refreshBtn') && el('refreshBtn').addEventListener('click', ()=> { try{ el('proxyFrame').contentWindow.location.reload(); }catch(e){ el('proxyFrame').src = el('proxyFrame').src; } });
    el('backBtn') && el('backBtn').addEventListener('click', ()=> { try{ el('proxyFrame').contentWindow.history.back(); }catch(e){ notify('Back not available'); } });
    el('forwardBtn') && el('forwardBtn').addEventListener('click', ()=> { try{ el('proxyFrame').contentWindow.history.forward(); }catch(e){ notify('Forward not available'); } });
    el('fullscreenBtn') && el('fullscreenBtn').addEventListener('click', ()=> {
      const f = el('proxyFrame');
      if(f.requestFullscreen) f.requestFullscreen();
      else if(f.webkitRequestFullscreen) f.webkitRequestFullscreen();
    });

    // Load hub data
    loadHub('./hubData.json');

    // Accessibility hint: hide scanner via escape
    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape'){
        const sf = el('scannerForm'); if(sf && !sf.classList.contains('hidden')) sf.classList.add('hidden');
      }
    });
  });

  // Expose a couple helpers (for debugging)
  window.ProjLib = window.ProjLib || {};
  window.ProjLib.applyTheme = applyTheme;
  window.ProjLib.processLoadUrl = processLoadUrl;

})(window.ProjLib = window.ProjLib || {});
