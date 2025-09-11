(function(projLib){
  'use strict';

  let HUB_DATA = null;
  let DEFAULT_HOME = null;
  const THEME_LIST = ['dark','kuromi','comic','cyberpunk','geek','tech','anime','minimal'];
  let themeIndex = 0;
  let scanlineInterval = null;
  let matrixInterval = null;

  // ---------- Utilities ----------
  projLib.isValidUrl = function(url){
    try {
      const u = new URL(url.startsWith('http') ? url : 'https://' + url);
      return u.hostname.includes('.') || u.hostname === 'localhost';
    } catch { return false; }
  };

  projLib.sanitizeText = function(txt){
    const div = document.createElement('div');
    div.textContent = txt;
    return div.innerHTML;
  };

  projLib.fetchWithTimeout = function(url, opts, timeoutMs){
    opts = opts || {};
    timeoutMs = timeoutMs || 15000;
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), timeoutMs);
    return fetch(url,{...opts,signal:controller.signal})
      .then(resp=>{ clearTimeout(timer); return resp; })
      .catch(err=>{ clearTimeout(timer); throw err; });
  };

  projLib.fetchWithRetry = function(url, opts, retries=2, timeoutMs){
    return projLib.fetchWithTimeout(url, opts, timeoutMs)
      .catch(err=>{
        if(retries>0) return projLib.fetchWithRetry(url,opts,retries-1,timeoutMs);
        throw err;
      });
  };

  // ---------- Ticker ----------
  projLib.fetchRSSFeed = function(feedUrl, cacheMs=600000){
    const key = 'rssFeedCache_'+feedUrl;
    const cached = localStorage.getItem(key);
    if(cached){
      try{
        const parsed = JSON.parse(cached);
        if(Date.now()-parsed.timestamp < cacheMs) return Promise.resolve(parsed.data);
      }catch{}
    }
    return projLib.fetchWithRetry(feedUrl).then(resp=>{
      if(!resp.ok) throw new Error('Network response error');
      return resp.text();
    }).then(data=>{
      localStorage.setItem(key, JSON.stringify({timestamp:Date.now(),data}));
      return data;
    });
  };

  projLib.updateTicker = function(){
    projLib.fetchRSSFeed('https://www.rtp.pt/noticias/rss/mundo')
      .then(xmlStr=>{
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlStr,'text/xml');
        const items = xml.getElementsByTagName('item');
        let html='';
        for(let i=0;i<items.length;i++){
          const title = items[i].getElementsByTagName('title')[0];
          const link = items[i].getElementsByTagName('link')[0];
          if(title && link){
            const safeTitle = projLib.sanitizeText(title.textContent);
            html += `<a href="${link.textContent}" target="_blank" style="color:inherit;text-decoration:none;margin-right:20px;">${safeTitle}</a> | `;
          }
        }
        if(html.endsWith(' | ')) html = html.slice(0,-3);
        const tickerEl = document.querySelector('.ticker');
        tickerEl.innerHTML = html;
        const containerWidth = document.querySelector('.ticker-container').offsetWidth;
        const contentWidth = tickerEl.scrollWidth;
        tickerEl.style.animationDuration = contentWidth>containerWidth ? (contentWidth/50)+'s' : '0s';
      })
      .catch(()=>{ document.querySelector('.ticker').innerText='Failed to load news feed.'; });
  };

  // ---------- Iframe ----------
  projLib.processLoadUrl = function(input){
    let url = (input||'').trim();
    if(!url) return;
    if(!url.startsWith('http://') && !url.startsWith('https://')){
      if(/\.\w{2,}/.test(url)) url='https://'+url;
      else url='https://swisscows.com/web?query='+encodeURIComponent(url);
    }
    const frame = document.getElementById('proxyFrame');
    frame.src = url;
    frame.style.display='block';
    document.getElementById('initialMessage').style.display='none';
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display='flex';
    frame.onload = ()=> overlay.style.display='none';
    frame.onerror = ()=> { overlay.style.display='none'; alert('Failed to load content'); };
  };

  // ---------- Hub Data ----------
  projLib.loadHubData = function(path){
    const cacheKey='hubDataCache';
    const cached = localStorage.getItem(cacheKey);
    if(cached){ try{ HUB_DATA = JSON.parse(cached); } catch{} }
    return projLib.fetchWithRetry(path, {}, 2, 10000)
      .then(resp=>{ if(!resp.ok) throw new Error('Failed to fetch hubData.json'); return resp.json(); })
      .then(data=>{ HUB_DATA=data; localStorage.setItem(cacheKey,JSON.stringify(data)); if(data.defaultHome) DEFAULT_HOME=data.defaultHome; return data; })
      .catch(()=>HUB_DATA||{categories:[]});
  };

  projLib.populateDropdowns = function(data){
    if(!data||!Array.isArray(data.categories)) return;
    data.categories.forEach(cat=>{
      const select = document.getElementById(cat.id);
      if(!select) return;
      select.innerHTML='';
      const placeholder = document.createElement('option');
      placeholder.value=''; placeholder.textContent=cat.label||'Select';
      select.appendChild(placeholder);
      if(Array.isArray(cat.links)){
        cat.links.forEach(link=>{
          if(link && link.url && link.name){
            const opt = document.createElement('option');
            opt.value = link.url; opt.textContent=link.name;
            select.appendChild(opt);
          }
        });
      }
    });
  };

  // ---------- Theme ----------
  projLib.applyTheme = function(theme){
    THEME_LIST.forEach(t=>document.body.classList.remove('theme-'+t));
    document.body.classList.add('theme-'+theme);
  };

  projLib.toggleTheme = function(){
    themeIndex=(themeIndex+1)%THEME_LIST.length;
    const theme = THEME_LIST[themeIndex];
    projLib.applyTheme(theme);
    if(theme==='tech'){ // tech scanlines
      if(scanlineInterval) clearInterval(scanlineInterval);
      const container = document.querySelector('.console-container');
      scanlineInterval=setInterval(()=>{
        const line=document.createElement('div');
        line.className='tech-scanline';
        line.style.top=Math.random()*container.offsetHeight+'px';
        container.appendChild(line);
        setTimeout(()=>line.remove(),800);
      },400);
    } else if(scanlineInterval){ clearInterval(scanlineInterval); scanlineInterval=null; }
  };

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded',function(){
    // Theme
    let theme=localStorage.getItem('theme')||'dark';
    if(!THEME_LIST.includes(theme)) theme='dark';
    themeIndex = THEME_LIST.indexOf(theme);
    projLib.applyTheme(theme);

    // Ticker
    projLib.updateTicker(); setInterval(projLib.updateTicker,600000);

    // Hub
    projLib.loadHubData('./hubData.json').then(data=>{
      projLib.populateDropdowns(data);
      projLib.processLoadUrl(DEFAULT_HOME);
    });

    // Dropdowns
    document.querySelectorAll('.dropdowns-grid select').forEach(sel=>{
      sel.addEventListener('change',ev=>{
        if(ev.target.value) projLib.processLoadUrl(ev.target.value);
        ev.target.selectedIndex=0;
      });
    });

    // Scanner toggle
    const scannerBtn=document.getElementById('scannerBtn');
    const scannerForm=document.getElementById('proxyForm');
    const urlInput=document.getElementById('urlInput');
    if(scannerBtn && scannerForm){
      scannerForm.style.display='none';
      scannerBtn.addEventListener('click',()=>{
        scannerForm.style.display = scannerForm.style.display==='flex' ? 'none':'flex';
        if(scannerForm.style.display==='flex') urlInput.focus();
      });
      scannerForm.addEventListener('submit',e=>{
        e.preventDefault();
        projLib.processLoadUrl(urlInput.value);
      });
    }

    // Fullscreen button
    const fullscreenBtn=document.getElementById('fullscreenBtn');
    if(fullscreenBtn){
      fullscreenBtn.addEventListener('click',()=>{
        const frame=document.getElementById('proxyFrame');
        if(frame.requestFullscreen) frame.requestFullscreen();
      });
    }

    // Theme button
    const themeBtn=document.getElementById('toggleThemeBtn');
    if(themeBtn) themeBtn.addEventListener('click',projLib.toggleTheme);
  });

})(window.ProjLib=window.ProjLib||{});
