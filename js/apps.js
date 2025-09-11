(function(projLib){
  'use strict';

  let HUB_DATA = null;
  let DEFAULT_HOME = null;
  let USE_PROXY = false;

  // ---------- Utilities ----------
  projLib.isValidUrl = function(e){
    try {
      const u = new URL(e.startsWith('http') ? e : 'https://' + e);
      return u.hostname.includes('.') || u.hostname === 'localhost';
    } catch { return false; }
  };

  projLib.sanitizeText = function(e){
    const t = document.createElement('div');
    t.textContent = e;
    return t.innerHTML;
  };

  projLib.fetchWithRetry = function(url, opts, retries, timeoutMs){
    retries = retries || 2;
    timeoutMs = timeoutMs || 15000;
    return new Promise((resolve, reject)=>{
      const controller = new AbortController();
      const timer = setTimeout(()=>controller.abort(), timeoutMs);
      fetch(url,{...opts,signal:controller.signal})
        .then(resp=>{
          clearTimeout(timer);
          if(!resp.ok) throw new Error('Network error');
          resolve(resp);
        })
        .catch(err=>{
          clearTimeout(timer);
          if(retries>0) projLib.fetchWithRetry(url,opts,retries-1,timeoutMs).then(resolve).catch(reject);
          else reject(err);
        });
    });
  };

  // ---------- Ticker ----------
  projLib.fetchRSSFeed = function(feedUrl){
    return projLib.fetchWithRetry(feedUrl).then(r=>r.text());
  };

  projLib.updateTicker = function(){
    projLib.fetchRSSFeed('https://www.rtp.pt/noticias/rss/mundo')
      .then(xmlStr=>{
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlStr,'text/xml');
        const items = xml.getElementsByTagName('item');
        let html = '';
        for(let i=0;i<items.length;i++){
          const title = items[i].getElementsByTagName('title')[0];
          const link = items[i].getElementsByTagName('link')[0];
          if(title && link){
            const safeTitle = projLib.sanitizeText(title.textContent);
            const href = link.textContent;
            html += `<a href="${href}" target="_blank">${safeTitle}</a> | `;
          }
        }
        if(html.endsWith(' | ')) html = html.slice(0,-3);
        document.querySelector('.ticker').innerHTML = html;
      })
      .catch(()=>{document.querySelector('.ticker').innerText='[feed unavailable]';});
  };

  // ---------- Proxy Loader ----------
  projLib.processLoadUrl = function(input){
    let t = (input||'').trim();
    if(!t) return;
    if(!projLib.isValidUrl(t)) {
      t = 'https://swisscows.com/web?query=' + encodeURIComponent(t);
    }
    if(!t.startsWith('http://') && !t.startsWith('https://')) t = 'https://' + t;

    document.getElementById('currentUrl').value = t;
    const frame = document.getElementById('proxyFrame');
    const overlay = document.getElementById('loadingOverlay');
    const idle = document.getElementById('initialMessage');

    idle.style.display = 'none';
    overlay.style.display = 'flex';

    frame.onload = ()=>{ overlay.style.display='none'; };
    frame.onerror = ()=>{ overlay.style.display='none'; };

    if(USE_PROXY){
      frame.src = '/worker/?target=' + encodeURIComponent(t);
    } else {
      frame.src = t;
    }
  };

  // ---------- Dynamic hub ----------
  projLib.loadHubData = function(path){
    return projLib.fetchWithRetry(path).then(resp=>resp.json()).then(data=>{
      HUB_DATA = data;
      if(typeof data.defaultHome==='string' && data.defaultHome) DEFAULT_HOME=data.defaultHome;
      return data;
    }).catch(()=>({categories:[]}));
  };

  projLib.populateDropdowns = function(data){
    if(!data || !Array.isArray(data.categories)) return;
    data.categories.forEach(cat=>{
      const select = document.getElementById(cat.id);
      if(!select) return;
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
    });
  };

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded',function(){
    // Ticker
    projLib.updateTicker();
    setInterval(projLib.updateTicker,600000);

    // Hub
    projLib.loadHubData('./hubData.json').then(data=>{
      projLib.populateDropdowns(data);
      projLib.processLoadUrl(DEFAULT_HOME);
    });

    // Proxy toggle
    const proxyToggle = document.getElementById('proxyToggle');
    proxyToggle.addEventListener('change', function(){
      USE_PROXY = this.checked;
    });

    // Scanner toggle
    const scannerBtn = document.getElementById('scannerBtn');
    const scannerBar = document.getElementById('scannerBar');
    scannerBtn.addEventListener('click',()=>{
      scannerBar.classList.toggle('hidden');
    });

    // Scanner form
    document.getElementById('proxyForm').addEventListener('submit',function(ev){
      ev.preventDefault();
      const t = document.getElementById('urlInput').value;
      projLib.processLoadUrl(t);
    });

    // Home / Refresh
    document.getElementById('homeBtn').addEventListener('click',()=>projLib.processLoadUrl(DEFAULT_HOME));
    document.getElementById('refreshBtn').addEventListener('click',()=>{
      const e=document.getElementById('currentUrl').value;
      if(e) projLib.processLoadUrl(e);
    });

    // Fullscreen
    const fsBtn = document.getElementById('fullscreenBtn');
    const frame = document.getElementById('proxyFrame');
    if(fsBtn){
      fsBtn.addEventListener('click', ()=>{
        const isFs = document.fullscreenElement;
        if(!isFs){
          frame.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
      });
    }

    // Dropdowns
    document.querySelector('.dropdowns-grid').addEventListener('change',function(ev){
      if(ev.target && ev.target.tagName.toLowerCase()==='select' && ev.target.value){
        projLib.processLoadUrl(ev.target.value);
        ev.target.selectedIndex=0;
      }
    });
  });

  window.projLib = projLib;
})(window.projLib||{});
