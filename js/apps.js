(function(projLib){
  'use strict';

  let HUB_DATA = null;
  let DEFAULT_HOME = null;

  const THEME_LIST = ['dark','kuromi','comic','cyberpunk','geek','tech','anime','minimal'];
  let themeIndex = 0;
  let scanlineInterval = null;

  // ---------- Utilities ----------
  projLib.isValidUrl = function(e){
    try {
      const u = new URL(e.startsWith('http') ? e : 'https://' + e);
      return u.hostname.includes('.') || u.hostname === 'localhost';
    } catch (err) { return false; }
  };

  projLib.sanitizeText = function(e){
    const t = document.createElement('div');
    t.textContent = e;
    return t.innerHTML;
  };

  projLib.fetchWithTimeout = function(url, opts, timeoutMs){
    opts = opts || {};
    timeoutMs = timeoutMs || 15000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, {...opts, signal: controller.signal})
      .then(resp => { clearTimeout(timer); return resp; })
      .catch(err => { clearTimeout(timer); throw err; });
  };

  projLib.fetchWithRetry = function(url, opts, retries, timeoutMs){
    retries = retries === undefined ? 2 : retries;
    timeoutMs = timeoutMs || 15000;
    return projLib.fetchWithTimeout(url, opts, timeoutMs)
      .catch(err => {
        if(retries > 0) return projLib.fetchWithRetry(url, opts, retries-1, timeoutMs);
        throw err;
      });
  };

  // ---------- RSS / Ticker ----------
  projLib.fetchRSSFeed = function(feedUrl, cacheMs){
    cacheMs = cacheMs || 600000;
    const key = 'rssFeedCache_' + feedUrl;
    const cached = localStorage.getItem(key);
    if(cached){
      try {
        const parsed = JSON.parse(cached);
        if(Date.now() - parsed.timestamp < cacheMs) return Promise.resolve(parsed.data);
      } catch {}
    }
    return projLib.fetchWithRetry(feedUrl).then(resp => {
      if(!resp.ok) throw new Error('Network response error');
      return resp.text();
    }).then(data => {
      localStorage.setItem(key, JSON.stringify({timestamp: Date.now(), data}));
      return data;
    });
  };

  projLib.updateTicker = function(){
    projLib.fetchRSSFeed('https://www.rtp.pt/noticias/rss/mundo')
      .then(xmlStr => {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlStr, 'text/xml');
        const items = xml.getElementsByTagName('item');
        let html = '';
        for(let i=0;i<items.length;i++){
          const title = items[i].getElementsByTagName('title')[0];
          const link = items[i].getElementsByTagName('link')[0];
          if(title && link){
            const safeTitle = projLib.sanitizeText(title.textContent);
            html += `<a href="${link.textContent}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration:none; margin-right:20px;">${safeTitle}</a> | `;
          }
        }
        if(html.endsWith(' | ')) html = html.slice(0,-3);
        const tickerEl = document.querySelector('.ticker');
        if(!tickerEl) return;
        tickerEl.innerHTML = html || '[No items]';
        const containerWidth = document.querySelector('.ticker-container').offsetWidth;
        const contentWidth = tickerEl.scrollWidth;
        if(contentWidth > containerWidth){
          const duration = Math.max(10, Math.round(contentWidth / 50));
          tickerEl.style.animation = `ticker ${duration}s linear infinite`;
        } else {
          tickerEl.style.animation = 'none';
          tickerEl.style.transform = 'translateX(0)';
        }
      })
      .catch(()=>{ 
        projLib.notifyUser('Failed to load news feed.');
        const tickerEl = document.querySelector('.ticker');
        if(tickerEl) tickerEl.innerText='Failed to load news feed.';
      });
  };

  // ---------- UI Helpers ----------
  projLib.notifyUser = function(msg){
    const t = document.getElementById('notification');
    if(!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'),4000);
  };

  projLib.applyTheme = function(mode){
    THEME_LIST.forEach(t => document.body.classList.remove('theme-'+t));
    if(mode) document.body.classList.add('theme-'+mode);
  };

  function triggerThemeEffects(theme){
    const container = document.querySelector('.console-container');

    // remove previous scanlines
    if(scanlineInterval){ clearInterval(scanlineInterval); scanlineInterval=null; }
    document.querySelectorAll('.tech-scanline').forEach(el=>el.remove());

    if(theme==='tech' && container){
      function addScanline(){
        const scan = document.createElement('div');
        scan.className='tech-scanline';
        scan.style.position = 'absolute';
        scan.style.left = '-10%';
        scan.style.width = '120%';
        scan.style.height = '1px';
        scan.style.opacity = '0.12';
        scan.style.background = 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)';
        scan.style.top = Math.random()*container.offsetHeight + 'px';
        container.appendChild(scan);
        setTimeout(()=>scan.remove(),800);
      }
      scanlineInterval = setInterval(addScanline,400);
    }
  }

  projLib.toggleTheme = function(){
    themeIndex = (themeIndex+1)%THEME_LIST.length;
    const theme = THEME_LIST[themeIndex];
    projLib.applyTheme(theme);
    triggerThemeEffects(theme);
    const btn = document.getElementById('toggleThemeBtn');
    if(btn) btn.textContent = 'Theme: '+theme.charAt(0).toUpperCase()+theme.slice(1);
    localStorage.setItem('theme', theme);
  };

  // ---------- Iframe ----------
  projLib.processLoadUrl = function(input){
    let t = (input||'').trim();
    if(!t) return;

    if(!t.startsWith('http://') && !t.startsWith('https://')){
      // if contains a dot, assume website; else search
      if(/\.\w{2,}/.test(t)) t='https://'+t;
      else t='https://swisscows.com/web?query='+encodeURIComponent(t);
    }

    const frame = document.getElementById('proxyFrame');
    if(!frame) return;

    // update internal readout (hidden)
    try { document.getElementById('currentUrl').value = t; } catch(e){}

    frame.removeAttribute('srcdoc');
    frame.style.display='block';
    const initialMessage = document.getElementById('initialMessage');
    if(initialMessage) initialMessage.style.display='none';
    const overlay = document.getElementById('loadingOverlay');
    if(overlay) overlay.style.display='flex';

    // onload: try read location, but catch cross-origin errors
    frame.onload = function(){
      if(overlay) overlay.style.display='none';
      try {
        document.getElementById('currentUrl').value = frame.contentWindow.location.href;
      } catch (err) {
        // cross-origin read blocked — fall back to src
        try { document.getElementById('currentUrl').value = frame.src; } catch(e){}
      }
    };
    frame.onerror = function(){
      if(overlay) overlay.style.display='none';
      projLib.notifyUser('Failed to load the content.');
      if(initialMessage) initialMessage.style.display='';
    };

    frame.setAttribute('allowfullscreen', 'true');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.src = t;
  };

  // ---------- Dynamic Hub ----------
  projLib.loadHubData = function(path){
    const cacheKey='hubDataCache';
    const cached = localStorage.getItem(cacheKey);
    if(cached){ try{ HUB_DATA = JSON.parse(cached); if(typeof HUB_DATA.defaultHome === 'string') DEFAULT_HOME = HUB_DATA.defaultHome; } catch{} }
    return projLib.fetchWithRetry(path, {}, 2, 10000)
      .then(resp => { if(!resp.ok) throw new Error('Failed to fetch hubData.json'); return resp.json(); })
      .then(data => { 
        HUB_DATA = data;
        localStorage.setItem(cacheKey, JSON.stringify(data));
        if(typeof data.defaultHome==='string' && data.defaultHome) DEFAULT_HOME = data.defaultHome;
        return data;
      })
      .catch(()=>{ if(!HUB_DATA) projLib.notifyUser('Could not load hub data; please check JSON.'); return HUB_DATA||{categories:[]}; });
  };

  projLib.populateDropdowns = function(data){
    if(!data||!Array.isArray(data.categories)) return;
    data.categories.forEach(cat => {
      const select = document.getElementById(cat.id);
      if(!select) return;
      select.innerHTML='';
      const placeholder = document.createElement('option');
      placeholder.value=''; placeholder.textContent = cat.label||'Select';
      select.appendChild(placeholder);
      if(Array.isArray(cat.links)){
        const frag = document.createDocumentFragment();
        cat.links.forEach(link => {
          if(!link||!link.url||!link.name) return;
          const opt = document.createElement('option');
          opt.value = link.url; opt.textContent = link.name;
          frag.appendChild(opt);
        });
        select.appendChild(frag);
      }
    });
  };

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', function(){
    // Theme
    let theme = localStorage.getItem('theme');
    if(!theme||!THEME_LIST.includes(theme)) theme='dark';
    themeIndex = THEME_LIST.indexOf(theme);
    projLib.applyTheme(theme);
    triggerThemeEffects(theme);
    const btn = document.getElementById('toggleThemeBtn');
    if(btn) btn.textContent = 'Theme: '+theme.charAt(0).toUpperCase()+theme.slice(1);

    // Ticker
    projLib.updateTicker(); setInterval(projLib.updateTicker, 600000);

    // Load hub
    projLib.loadHubData('./hubData.json').then(data=>{
      projLib.populateDropdowns(data);
      // load configured home if any
      if(DEFAULT_HOME) projLib.processLoadUrl(DEFAULT_HOME);
      else if(data && data.defaultHome) projLib.processLoadUrl(data.defaultHome);
    });

    // Dropdowns: use the grid wrapper for event delegation
    const ddGrid = document.querySelector('.dropdowns-grid');
    if(ddGrid){
      ddGrid.addEventListener('change', function(ev){
        if(ev.target && ev.target.tagName && ev.target.tagName.toLowerCase()==='select'){
          const val = ev.target.value;
          if(val) projLib.processLoadUrl(val);
          // reset to placeholder (use slight delay so selection event registers visually)
          setTimeout(()=>{ ev.target.selectedIndex = 0; }, 100);
        }
      });
    }

    // Scanner toggle
    const scannerBtn = document.getElementById('scannerBtn');
    const scannerForm = document.getElementById('scannerForm');
    const urlInput = document.getElementById('urlInput');
    if(scannerForm){ scannerForm.classList.add('hidden'); }
    if(scannerBtn){
      scannerBtn.addEventListener('click', ()=>{
        if(!scannerForm) return;
        scannerForm.classList.toggle('hidden');
        // focus when visible
        if(!scannerForm.classList.contains('hidden') && urlInput) urlInput.focus();
      });
    }

    if(scannerForm){
      scannerForm.addEventListener('submit', function(e){
        e.preventDefault();
        if(urlInput) {
          projLib.processLoadUrl(urlInput.value || '');
          // optionally hide after submission
          scannerForm.classList.add('hidden');
        }
      });
    }

    // Theme button
    if(btn) btn.addEventListener('click', projLib.toggleTheme);

    // Fullscreen button
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if(fullscreenBtn){
      fullscreenBtn.addEventListener('click', ()=>{
        const frame = document.getElementById('proxyFrame');
        if(!frame) return;
        if(frame.requestFullscreen) frame.requestFullscreen();
        else if(frame.webkitRequestFullscreen) frame.webkitRequestFullscreen();
        else if(frame.mozRequestFullScreen) frame.mozRequestFullScreen();
        else if(frame.msRequestFullscreen) frame.msRequestFullscreen();
      });
    }

    // Home button
    const homeBtn = document.getElementById('homeBtn');
    if(homeBtn){
      homeBtn.addEventListener('click', ()=>{
        const home = DEFAULT_HOME || (HUB_DATA && HUB_DATA.defaultHome) || '';
        if(home) projLib.processLoadUrl(home);
        else projLib.notifyUser('No home URL configured.');
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if(refreshBtn){
      refreshBtn.addEventListener('click', ()=>{
        const frame = document.getElementById('proxyFrame');
        if(!frame) return;
        try {
          frame.contentWindow.location.reload();
        } catch (err) {
          // cross-origin or other issue — fallback to reset src
          frame.src = frame.src;
        }
      });
    }

    // keyboard: ESC hides scanner if visible
    document.addEventListener('keydown', function(ev){
      if(ev.key === 'Escape'){
        if(scannerForm && !scannerForm.classList.contains('hidden')) scannerForm.classList.add('hidden');
      }
    });

    // Worker placeholder (no-op if not present)
    const workerEl = document.getElementById('workerPlaceholder');
    if(workerEl) workerEl.style.display='block';
  });

})(window.ProjLib=window.ProjLib||{});
