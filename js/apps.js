(function(projLib){ 
  'use strict';

  let HUB_DATA = null;
  let DEFAULT_HOME = null;
  let WHITELIST = [];

  const THEME_LIST = ['dark','kuromi','comic','cyberpunk','geek','tech','anime','minimal'];
  let themeIndex = 0;

  // ---------- Utilities ----------
  projLib.isValidUrl = function(e){
    try {
      const u = new URL(e.startsWith('http')? e : 'https://'+e);
      return u.hostname.includes('.') || u.hostname==='localhost';
    } catch { return false; }
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
    retries = retries===undefined? 2 : retries;
    timeoutMs = timeoutMs || 15000;
    return projLib.fetchWithTimeout(url, opts, timeoutMs)
      .catch(err => { if(retries>0) return projLib.fetchWithRetry(url, opts, retries-1, timeoutMs); throw err; });
  };

  // ---------- RSS / Ticker ----------
  projLib.fetchRSSFeed = function(feedUrl, cacheMs){
    cacheMs = cacheMs || 600000;
    const key = 'rssFeedCache_'+feedUrl;
    const cached = localStorage.getItem(key);
    if(cached){
      try{
        const parsed = JSON.parse(cached);
        if(Date.now() - parsed.timestamp < cacheMs) return Promise.resolve(parsed.data);
      } catch {}
    }
    return projLib.fetchWithRetry(feedUrl)
      .then(resp => { if(!resp.ok) throw new Error('Network response error'); return resp.text(); })
      .then(data => { localStorage.setItem(key, JSON.stringify({timestamp: Date.now(), data})); return data; });
  };

  projLib.updateTicker = function(){
    projLib.fetchRSSFeed('https://www.rtp.pt/noticias/rss/mundo')
      .then(xmlStr => {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlStr,'text/xml');
        const items = xml.getElementsByTagName('item');
        let html = '';
        for(let i=0;i<items.length;i++){
          const title = items[i].getElementsByTagName('title')[0];
          const link = items[i].getElementsByTagName('link')[0];
          if(title && link){
            const safeTitle = projLib.sanitizeText(title.textContent);
            html += `<a href="${link.textContent}" target="_blank" style="color: inherit; text-decoration: none; margin-right: 20px;">${safeTitle}</a> | `;
          }
        }
        if(html.endsWith(' | ')) html = html.slice(0,-3);
        const tickerEl = document.querySelector('.ticker');
        if(tickerEl) tickerEl.innerHTML = html;
        const containerWidth = document.querySelector('.ticker-container').offsetWidth;
        const contentWidth = tickerEl.scrollWidth;
        if(contentWidth>containerWidth) tickerEl.style.animationDuration = (contentWidth/50)+'s';
        else tickerEl.style.animation = 'none';
      })
      .catch(() => {
        projLib.notifyUser('Failed to load news feed.');
        document.querySelector('.ticker').innerText='Failed to load news feed.';
      });
  };

  // ---------- UI helpers ----------
  projLib.notifyUser = function(msg){
    const t = document.getElementById('notification');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 4000);
  };

  projLib.applyTheme = function(mode){
    THEME_LIST.forEach(t => document.body.classList.remove('theme-'+t));
    document.body.classList.add('theme-'+mode);
  };

  // ---------- Theme effects ----------
  let comicClickHandler=null, animeTrailHandler=null, techScanHandler=null;

  function triggerThemeEffects(theme){
    const container = document.querySelector('.container');
    if(comicClickHandler){ container.removeEventListener('click', comicClickHandler); comicClickHandler=null; }
    if(animeTrailHandler){ container.removeEventListener('mousemove', animeTrailHandler); animeTrailHandler=null; }
    if(techScanHandler){ clearInterval(techScanHandler); techScanHandler=null; }

    if(theme==='kuromi'){
      const spark = document.createElement('div');
      spark.className='kuromi-spark';
      spark.style.left=Math.random()*container.offsetWidth+'px';
      spark.style.top=Math.random()*container.offsetHeight+'px';
      container.appendChild(spark);
      setTimeout(()=>spark.remove(),2000);
    }
    else if(theme==='comic'){
      comicClickHandler = function(e){
        const pop=document.createElement('div');
        pop.className='comic-pop';
        pop.style.left=e.offsetX+'px';
        pop.style.top=e.offsetY+'px';
        pop.textContent=Math.random()<0.5?'POW!':'BAM!';
        container.appendChild(pop);
        setTimeout(()=>pop.remove(),600);
      };
      container.addEventListener('click', comicClickHandler);
    }
    else if(theme==='anime'){
      animeTrailHandler = function(e){
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const star=document.createElement('div');
        star.className='anime-star';
        star.style.left = Math.max(0, Math.min(rect.width, x)) + 'px';
        star.style.top = Math.max(0, Math.min(rect.height, y)) + 'px';
        container.appendChild(star);
        setTimeout(()=>star.remove(),700);
      };
      container.addEventListener('mousemove', animeTrailHandler);
    }
    else if(theme==='tech'){
      function addScanline(){
        const scan=document.createElement('div');
        scan.className='tech-scanline';
        scan.style.top=Math.random()*container.offsetHeight+'px';
        container.appendChild(scan);
        setTimeout(()=>scan.remove(),800);
      }
      techScanHandler = setInterval(addScanline,400);
    }
    else if(theme==='geek'){
      const pulse=document.createElement('div');
      pulse.className='geek-pulse';
      pulse.style.left=Math.random()*container.offsetWidth+'px';
      pulse.style.top=Math.random()*container.offsetHeight+'px';
      container.appendChild(pulse);
      setTimeout(()=>pulse.remove(),1200);
    }
    else if(theme==='minimal'){
      const dot=document.createElement('div');
      dot.className='minimal-dot';
      dot.style.left=Math.random()*container.offsetWidth+'px';
      dot.style.top=Math.random()*container.offsetHeight+'px';
      container.appendChild(dot);
      setTimeout(()=>dot.remove(),1000);
    }
  }

  projLib.toggleTheme = function(){
    themeIndex = (themeIndex+1) % THEME_LIST.length;
    const theme = THEME_LIST[themeIndex];
    projLib.applyTheme(theme);
    triggerThemeEffects(theme);
    const btn = document.getElementById('toggleThemeBtn');
    if(btn) btn.textContent = 'Theme: ' + theme.charAt(0).toUpperCase() + theme.slice(1);
  };

  // ---------- Whitelist & iframe ----------
  projLib.processLoadUrl = function(input){
    let t = (input||'').trim();
    if(!t) return;
    if(!projLib.isValidUrl(t)) t = 'https://swisscows.com/web?query='+encodeURIComponent(t);
    if(!t.startsWith('http://')&&!t.startsWith('https://')) t='https://'+t;

    const frame = document.getElementById('proxyFrame');
    document.getElementById('currentUrl').value = t;
    document.getElementById('initialMessage').style.display='none';
    frame.style.display='block';
    document.getElementById('loadingOverlay').style.display='flex';

    frame.onload = function(){
      document.getElementById('loadingOverlay').style.display='none';
      document.getElementById('currentUrl').value = frame.contentWindow.location.href;

      // Apply containment unless whitelisted
      const hostname = new URL(frame.contentWindow.location.href).hostname;
      if(!WHITELIST.includes(hostname)){
        // Example: disable popups / top navigation override
        try{frame.contentWindow.open = function(){ return frame.contentWindow; }}catch{}
        try{frame.contentWindow.alert = function(){};}catch{}
      }
    };

    frame.onerror = function(){
      document.getElementById('loadingOverlay').style.display='none';
      projLib.notifyUser('Failed to load the content.');
    };

    // Unrestricted iframe (no sandbox)
    frame.removeAttribute('sandbox');
    frame.setAttribute('allowfullscreen','true');
    frame.setAttribute('referrerpolicy','no-referrer');
    frame.src = t;
  };

  // ---------- Load hub & whitelist ----------
  projLib.loadHubData = function(path){
    const cacheKey='hubDataCache';
    const cached = localStorage.getItem(cacheKey);
    if(cached){ try{ HUB_DATA=JSON.parse(cached); }catch{} }
    return projLib.fetchWithRetry(path,{},2,10000)
      .then(resp => { if(!resp.ok) throw new Error('Failed to fetch hubData.json'); return resp.json(); })
      .then(data => {
        HUB_DATA = data;
        localStorage.setItem(cacheKey, JSON.stringify(data));
        if(typeof data.defaultHome==='string' && data.defaultHome) DEFAULT_HOME = data.defaultHome;
        if(Array.isArray(data.whitelist)) WHITELIST = data.whitelist.map(u => new URL(u).hostname);
        return data;
      })
      .catch(() => { if(!HUB_DATA) projLib.notifyUser('Could not load hub data.'); return HUB_DATA || {categories:[]}; });
  };

  projLib.populateDropdowns = function(data){
    if(!data||!Array.isArray(data.categories)) return;
    data.categories.forEach(cat => {
      const select = document.getElementById(cat.id);
      if(!select) return;
      select.innerHTML='';
      const placeholder = document.createElement('option');
      placeholder.value='';
      placeholder.textContent = cat.label||'Select';
      select.appendChild(placeholder);
      if(Array.isArray(cat.links)){
        const frag = document.createDocumentFragment();
        cat.links.forEach(link => {
          if(!link||!link.url||!link.name) return;
          const opt = document.createElement('option');
          opt.value = link.url;
          opt.textContent = link.name;
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
    if(btn) btn.textContent = 'Theme: ' + theme.charAt(0).toUpperCase() + theme.slice(1);

    // Ticker
    projLib.updateTicker();
    setInterval(projLib.updateTicker, 600000);

    // Load hub
    projLib.loadHubData('./hubData.json').then(data => {
      projLib.populateDropdowns(data);
      projLib.processLoadUrl(DEFAULT_HOME);
    });

    // Events
    document.getElementById('proxyForm').addEventListener('submit', function(ev){
      ev.preventDefault();
      projLib.processLoadUrl(document.getElementById('urlInput').value);
    });

    document.getElementById('homeBtn').addEventListener('click', function(){
      projLib.processLoadUrl(DEFAULT_HOME);
    });

    document.getElementById('refreshBtn').addEventListener('click', function(){
      projLib.processLoadUrl(document.getElementById('currentUrl').value);
    });

    document.querySelector('.dropdowns-container').addEventListener('change', function(ev){
      if(ev.target && ev.target.tagName && ev.target.tagName.toLowerCase()==='select' && ev.target.value){
        projLib.processLoadUrl(ev.target.value);
        ev.target.selectedIndex = 0;
      }
    });

    document.getElementById('maskTab').addEventListener('change', function(ev){
      if(!ev.target.value) return;
      const [title,iconUrl] = ev.target.value.split('|');
      document.title = title;
      let link=document.querySelector("link[rel~='icon']");
      if(!link){ link=document.createElement('link'); link.rel='icon'; document.head.appendChild(link); }
      link.href = iconUrl;
      ev.target.selectedIndex=0;
    });

    document.getElementById('toggleThemeBtn').addEventListener('click', projLib.toggleTheme);

    // Fullscreen
    const fsBtn = document.getElementById('fullscreenBtn');
    const frame = document.getElementById('proxyFrame');
    if(fsBtn){
      fsBtn.textContent='Fullscreen';
      fsBtn.addEventListener('click', function(){
        if(!frame) return;
        const isFs = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
        if(!isFs){
          if(frame.requestFullscreen) frame.requestFullscreen();
          else if(frame.webkitRequestFullscreen) frame.webkitRequestFullscreen();
          else if(frame.mozRequestFullScreen) frame.mozRequestFullScreen();
          else if(frame.msRequestFullscreen) frame.msRequestFullscreen();
        } else {
          if(document.exitFullscreen) document.exitFullscreen();
          else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
          else if(document.mozCancelFullScreen) document.mozCancelFullScreen();
          else if(document.msExitFullscreen) document.msExitFullscreen();
        }
      });

      function updateFsText(){
        const active = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
        fsBtn.textContent = active ? 'Exit Fullscreen' : 'Fullscreen';
      }
      document.addEventListener('fullscreenchange', updateFsText);
      document.addEventListener('webkitfullscreenchange', updateFsText);
      document.addEventListener('mozfullscreenchange', updateFsText);
      document.addEventListener('MSFullscreenChange', updateFsText);
    }

    // Real-time URL tracking
    setInterval(()=>{
      try{ document.getElementById('currentUrl').value = frame.contentWindow.location.href; }catch{}
    },500);

  });

  window.projLib = projLib;

})(window.projLib||{});
