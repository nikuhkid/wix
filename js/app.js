(function(projLib){
  'use strict';

  let HUB_DATA=null;
  let DEFAULT_HOME=null;

  const THEME_LIST=['dark','kuromi','comic','cyberpunk','geek','tech','anime','minimal'];
  let themeIndex=0;

  // ---------- Utilities ----------
  projLib.isValidUrl=function(e){
    try{const u=new URL(e.startsWith('http')?e:'https://'+e);return u.hostname.includes('.')||u.hostname==='localhost';}catch{return false;}
  };
  projLib.sanitizeText=function(e){const t=document.createElement('div');t.textContent=e;return t.innerHTML;};
  projLib.fetchWithTimeout=function(url,opts,timeoutMs){opts=opts||{};timeoutMs=timeoutMs||15000;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);return fetch(url,{...opts,signal:controller.signal}).then(resp=>{clearTimeout(timer);return resp;}).catch(err=>{clearTimeout(timer);throw err;});};
  projLib.fetchWithRetry=function(url,opts,retries,timeoutMs){retries=retries===undefined?2:retries;timeoutMs=timeoutMs||15000;return projLib.fetchWithTimeout(url,opts,timeoutMs).catch(err=>{if(retries>0)return projLib.fetchWithRetry(url,opts,retries-1,timeoutMs);throw err;});};

  // ---------- RSS / Ticker ----------
  projLib.fetchRSSFeed=function(feedUrl,cacheMs){cacheMs=cacheMs||600000;const key='rssFeedCache_'+feedUrl;const cached=localStorage.getItem(key);if(cached){try{const parsed=JSON.parse(cached);if(Date.now()-parsed.timestamp<cacheMs)return Promise.resolve(parsed.data);}catch{}}
    return projLib.fetchWithRetry(feedUrl).then(resp=>{if(!resp.ok)throw new Error('Network response error');return resp.text();}).then(data=>{localStorage.setItem(key,JSON.stringify({timestamp:Date.now(),data}));return data;});
  };
  projLib.updateTicker=function(){projLib.fetchRSSFeed('https://www.rtp.pt/noticias/rss/mundo').then(xmlStr=>{const parser=new DOMParser();const xml=parser.parseFromString(xmlStr,'text/xml');const items=xml.getElementsByTagName('item');let html='';for(let i=0;i<items.length;i++){const title=items[i].getElementsByTagName('title')[0];const link=items[i].getElementsByTagName('link')[0];if(title&&link){const safeTitle=projLib.sanitizeText(title.textContent);const href=link.textContent;html+=`<a href="${href}" target="_blank" style="color: inherit; text-decoration: none; margin-right: 20px;">${safeTitle}</a> | `;}}if(html.endsWith(' | '))html=html.slice(0,-3);document.querySelector('.ticker').innerHTML=html;const containerWidth=document.querySelector('.ticker-container').offsetWidth;const contentWidth=document.querySelector('.ticker').scrollWidth;if(contentWidth>containerWidth){const duration=contentWidth/50;document.querySelector('.ticker').style.animationDuration=duration+'s';}else{document.querySelector('.ticker').style.animation='none';}}).catch(()=>{projLib.notifyUser('Failed to load news feed.');document.querySelector('.ticker').innerText='Failed to load news feed.';});};

  // ---------- UI helpers ----------
  projLib.notifyUser=function(msg){const t=document.getElementById('notification');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),4000);};
  projLib.applyTheme=function(mode){THEME_LIST.forEach(t=>document.body.classList.remove('theme-'+t));document.body.classList.add('theme-'+mode);};

  // --- Theme effects handlers ---
  let comicClickHandler = null;
  let animeTrailHandler = null;
  let techScanHandler = null;
  function triggerThemeEffects(theme){
    const container=document.querySelector('.container');
    // Remove previous handlers if any
    if(comicClickHandler) { container.removeEventListener('click', comicClickHandler); comicClickHandler = null; }
    if(animeTrailHandler) { container.removeEventListener('mousemove', animeTrailHandler); animeTrailHandler = null; }
    if(techScanHandler) { clearInterval(techScanHandler); techScanHandler = null; }

    // Kuromi: spark
    if(theme==='kuromi'){
      const spark=document.createElement('div');
      spark.className='kuromi-spark';
      spark.style.left=Math.random()*container.offsetWidth+'px';
      spark.style.top=Math.random()*container.offsetHeight+'px';
      container.appendChild(spark);
      setTimeout(()=>spark.remove(),2000);
    }
    // Comic: POW/BAM on click
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
    // Anime: trail of stars
    else if(theme==='anime'){
      animeTrailHandler = function(e){
        const star=document.createElement('div');
        star.className='anime-star';
        star.style.left=e.offsetX+'px';
        star.style.top=e.offsetY+'px';
        container.appendChild(star);
        setTimeout(()=>star.remove(),700);
      };
      container.addEventListener('mousemove', animeTrailHandler);
    }
    // Tech: scanlines effect
    else if(theme==='tech'){
      function addScanline(){
        const scan=document.createElement('div');
        scan.className='tech-scanline';
        scan.style.top=Math.random()*container.offsetHeight+'px';
        container.appendChild(scan);
        setTimeout(()=>scan.remove(),800);
      }
      techScanHandler = setInterval(addScanline, 400);
    }
    // Geek: neon pulse
    else if(theme==='geek'){
      const pulse=document.createElement('div');
      pulse.className='geek-pulse';
      pulse.style.left=Math.random()*container.offsetWidth+'px';
      pulse.style.top=Math.random()*container.offsetHeight+'px';
      container.appendChild(pulse);
      setTimeout(()=>pulse.remove(),1200);
    }
    // Cyberpunk: keep glitch (handled by CSS)
    // Minimal: subtle cyan dot
    else if(theme==='minimal'){
      const dot=document.createElement('div');
      dot.className='minimal-dot';
      dot.style.left=Math.random()*container.offsetWidth+'px';
      dot.style.top=Math.random()*container.offsetHeight+'px';
      container.appendChild(dot);
      setTimeout(()=>dot.remove(),1000);
    }
  }

  projLib.toggleTheme=function(){
    themeIndex=(themeIndex+1)%THEME_LIST.length;
    const theme=THEME_LIST[themeIndex];
    projLib.applyTheme(theme);
    triggerThemeEffects(theme);
    // Update theme button text
    const btn = document.getElementById('toggleThemeBtn');
    if(btn) btn.textContent = 'Theme: ' + theme.charAt(0).toUpperCase() + theme.slice(1);
  };

  // ---------- Iframe ----------
  projLib.processLoadUrl=function(input){
    let t=(input||'').trim();if(!t)return;if(!projLib.isValidUrl(t))t='https://swisscows.com/web?query='+encodeURIComponent(t);if(!t.startsWith('http://')&&!t.startsWith('https://'))t='https://'+t;
    document.getElementById('currentUrl').value=t;
    const frame=document.getElementById('proxyFrame');frame.removeAttribute('srcdoc');frame.style.display='block';document.getElementById('initialMessage').style.display='none';
    const overlay=document.getElementById('loadingOverlay');overlay.style.display='flex';
    frame.onload=function(){overlay.style.display='none';document.getElementById('currentUrl').value=frame.contentWindow.location.href;};
    frame.onerror=function(){overlay.style.display='none';projLib.notifyUser('Failed to load the content.');};
    frame.setAttribute('sandbox','allow-forms allow-scripts allow-same-origin allow-popups');
    frame.src=t;
  };

  // ---------- Dynamic hub ----------
  projLib.loadHubData=function(path){
    const cacheKey='hubDataCache';const cached=localStorage.getItem(cacheKey);if(cached){try{HUB_DATA=JSON.parse(cached);}catch{HUB_DATA=null;}}
    return projLib.fetchWithRetry(path,{},2,10000).then(resp=>{if(!resp.ok)throw new Error('Failed to fetch hubData.json');return resp.json();}).then(data=>{HUB_DATA=data;localStorage.setItem(cacheKey,JSON.stringify(data));if(typeof data.defaultHome==='string'&&data.defaultHome)DEFAULT_HOME=data.defaultHome;return data;}).catch(()=>{if(!HUB_DATA)projLib.notifyUser('Could not load hub data; please check JSON.');return HUB_DATA||{categories:[]};});
  };

  projLib.populateDropdowns=function(data){
    if(!data||!Array.isArray(data.categories))return;
    data.categories.forEach(cat=>{
      const select=document.getElementById(cat.id);
      if(!select) return;
      select.innerHTML='';
      const placeholder=document.createElement('option');
      placeholder.value='';
      placeholder.textContent=cat.label||'Select';
      select.appendChild(placeholder);
      if(Array.isArray(cat.links)){
        const frag=document.createDocumentFragment();
        cat.links.forEach(link=>{
          if(!link||!link.url||!link.name) return;
          const opt=document.createElement('option');
          opt.value=link.url;
          opt.textContent=link.name;
          frag.appendChild(opt);
        });
        select.appendChild(frag);
      }
    });
  };

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded',function(){
    // Theme
  let theme=localStorage.getItem('theme');
  if(!theme||!THEME_LIST.includes(theme)) theme='dark';
  themeIndex=THEME_LIST.indexOf(theme);
  projLib.applyTheme(theme);
  triggerThemeEffects(theme);
  // Set initial theme button text
  const btn = document.getElementById('toggleThemeBtn');
  if(btn) btn.textContent = 'Theme: ' + theme.charAt(0).toUpperCase() + theme.slice(1);

    // Ticker
    projLib.updateTicker();setInterval(projLib.updateTicker,600000);

    // Load hub data then UI
    projLib.loadHubData('./hubData.json').then(data=>{projLib.populateDropdowns(data);projLib.processLoadUrl(DEFAULT_HOME);});

    // Events
    document.getElementById('proxyForm').addEventListener('submit',function(ev){ev.preventDefault();const t=document.getElementById('urlInput').value;projLib.processLoadUrl(t);});
    document.getElementById('homeBtn').addEventListener('click',function(){projLib.processLoadUrl(DEFAULT_HOME);});
    document.getElementById('refreshBtn').addEventListener('click',function(){const e=document.getElementById('currentUrl').value;if(e)projLib.processLoadUrl(e);});
    // Dropdowns: only listen for selects inside the dropdowns-container
    const dropdownsRow = document.querySelector('.dropdowns-container');
    if(dropdownsRow) dropdownsRow.addEventListener('change',function(ev){
      if(ev.target && ev.target.tagName && ev.target.tagName.toLowerCase()==='select' && ev.target.value){
        projLib.processLoadUrl(ev.target.value);
        ev.target.selectedIndex=0;
      }
    });
    document.getElementById('maskTab').addEventListener('change',function(ev){if(!ev.target.value)return;const [title,iconUrl]=ev.target.value.split('|');document.title=title;let link=document.querySelector("link[rel~='icon']");if(!link){link=document.createElement('link');link.rel='icon';document.head.appendChild(link);}link.href=iconUrl;ev.target.selectedIndex=0;});
    document.getElementById('toggleThemeBtn').addEventListener('click',projLib.toggleTheme);
    // Fullscreen button for iframe using Fullscreen API (with fallbacks)
    const fsBtn = document.getElementById('fullscreenBtn');
    const frame = document.getElementById('proxyFrame');
    if(fsBtn){
      // init text
      fsBtn.textContent = 'Fullscreen';
      fsBtn.addEventListener('click', function(){
        if(!frame) return;
        const isFs = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
        if(!isFs){
          const el = frame;
          if(el.requestFullscreen) el.requestFullscreen();
          else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen();
          else if(el.mozRequestFullScreen) el.mozRequestFullScreen();
          else if(el.msRequestFullscreen) el.msRequestFullscreen();
        } else {
          if(document.exitFullscreen) document.exitFullscreen();
          else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
          else if(document.mozCancelFullScreen) document.mozCancelFullScreen();
          else if(document.msExitFullscreen) document.msExitFullscreen();
        }
      });

      // Update button text when fullscreen state changes
      function updateFsText(){
        const active = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
        fsBtn.textContent = active ? 'Exit Fullscreen' : 'Fullscreen';
      }
      document.addEventListener('fullscreenchange', updateFsText);
      document.addEventListener('webkitfullscreenchange', updateFsText);
      document.addEventListener('mozfullscreenchange', updateFsText);
      document.addEventListener('MSFullscreenChange', updateFsText);
    }

  // Real-time URL tracking inside iframe
  const iframeEl = document.getElementById('proxyFrame');
  setInterval(()=>{try{document.getElementById('currentUrl').value=iframeEl.contentWindow.location.href;}catch{}},500);
  });

  window.projLib=projLib;
})(window.projLib||{});
