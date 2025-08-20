(function(projLib){
  'use strict';

  let HUB_DATA=null;
  let DEFAULT_HOME=null;

  // All-dark theme list
  const THEME_LIST=['dark','geek','minimal','kuromi','tech','comic','anime','cyberpunk'];
  let themeIndex=0;

  // ---------- Utils ----------
  projLib.isValidUrl=function(e){
    try{
      const u=new URL(e.startsWith('http')?e:'https://'+e);
      return u.hostname.includes('.')||u.hostname==='localhost';
    }catch{ return false; }
  };
  projLib.sanitizeText=function(e){const t=document.createElement('div');t.textContent=e;return t.innerHTML;};
  projLib.fetchWithTimeout=function(url,opts,timeoutMs){
    opts=opts||{};timeoutMs=timeoutMs||15000;
    const c=new AbortController();const t=setTimeout(()=>c.abort(),timeoutMs);
    return fetch(url,{...opts,signal:c.signal}).then(r=>{clearTimeout(t);return r;}).catch(err=>{clearTimeout(t);throw err;});
  };
  projLib.fetchWithRetry=function(url,opts,retries,timeoutMs){
    retries=retries===undefined?2:retries;timeoutMs=timeoutMs||15000;
    return projLib.fetchWithTimeout(url,opts,timeoutMs).catch(err=>{
      if(retries>0) return projLib.fetchWithRetry(url,opts,retries-1,timeoutMs);
      throw err;
    });
  };

  // ---------- Ticker (no CORS proxy) ----------
  projLib.updateTicker=function(){
    projLib.fetchWithRetry('https://www.rtp.pt/noticias/rss/mundo')
      .then(r=>{ if(!r.ok) throw new Error('RSS fetch failed'); return r.text(); })
      .then(xmlStr=>{
        const xml=new DOMParser().parseFromString(xmlStr,'text/xml');
        const items=xml.getElementsByTagName('item');
        let html='';
        for(let i=0;i<items.length;i++){
          const t=items[i].getElementsByTagName('title')[0];
          const l=items[i].getElementsByTagName('link')[0];
          if(t&&l){
            html+=`<a href="${l.textContent}" target="_blank" style="color:inherit;text-decoration:none;margin-right:20px;">${projLib.sanitizeText(t.textContent)}</a> | `;
          }
        }
        if(html.endsWith(' | ')) html=html.slice(0,-3);
        const tick=document.querySelector('.ticker');
        if(tick) tick.innerHTML=html||'No items.';
      })
      .catch(()=>{
        const tick=document.querySelector('.ticker');
        if(tick) tick.textContent='Failed to load news feed.';
      });
  };

  // ---------- Theme ----------
  projLib.applyTheme=function(mode){
    THEME_LIST.forEach(t=>document.body.classList.remove('theme-'+t));
    document.body.classList.add('theme-'+mode);
    try{ localStorage.setItem('theme',mode); }catch{}
  };
  projLib.toggleTheme=function(){
    themeIndex=(themeIndex+1)%THEME_LIST.length;
    projLib.applyTheme(THEME_LIST[themeIndex]);
  };

  // ---------- Iframe loading ----------
  projLib.processLoadUrl=function(input){
    let t=(input||'').trim();
    if(!t) return;
    if(!projLib.isValidUrl(t)) t='https://swisscows.com/web?query='+encodeURIComponent(t);
    if(!t.startsWith('http://')&&!t.startsWith('https://')) t='https://'+t;

    const urlOut=document.getElementById('currentUrl');
    const frame=document.getElementById('proxyFrame');
    const init=document.getElementById('initialMessage');
    const overlay=document.getElementById('loadingOverlay');

    if(urlOut) urlOut.value=t;
    if(init) init.style.display='none';
    if(frame){
      // keep sandbox to prevent top escape
      frame.setAttribute('sandbox','allow-forms allow-scripts allow-same-origin allow-popups');
      if(overlay) overlay.style.display='flex';
      frame.onload=function(){
        if(overlay) overlay.style.display='none';
        // Cross-origin reality: you cannot reliably read iframe inner URL.
        // So we set to frame.src on load. For same-origin pages, try read href.
        try{
          const href=frame.contentWindow.location && frame.contentWindow.location.href;
          if(urlOut && href) urlOut.value=href;
        }catch{
          if(urlOut) urlOut.value=frame.src;
        }
      };
      frame.onerror=function(){ if(overlay) overlay.style.display='none'; projLib.notifyUser('Failed to load the content.'); };
      frame.src=t;
    }
  };

  // Best-effort periodic update. SOP will block for cross-origin; we fall back silently.
  function startUrlPoll(){
    const frame=document.getElementById('proxyFrame');
    const urlOut=document.getElementById('currentUrl');
    if(!frame||!urlOut) return;
    setInterval(()=>{
      try{
        const href=frame.contentWindow.location && frame.contentWindow.location.href;
        if(href && href!==urlOut.value) urlOut.value=href;
      }catch{
        // Cross-origin: nothing to do. We keep last known URL.
      }
    }, 700);
  }

  // ---------- Hub data ----------
  projLib.loadHubData=function(path){
    return projLib.fetchWithRetry(path,{},2,10000)
      .then(resp=>{ if(!resp.ok) throw new Error('hubData fetch failed'); return resp.json(); })
      .then(data=>{
        HUB_DATA=data;
        if(typeof data.defaultHome==='string' && data.defaultHome) DEFAULT_HOME=data.defaultHome;
        projLib.populateDropdowns(data);
        return data;
      })
      .catch(err=>{
        projLib.notifyUser('Could not load hub data. Check hubData.json path/JSON validity.');
        throw err;
      });
  };

  projLib.populateDropdowns=function(data){
    if(!data || !Array.isArray(data.categories)) return;
    data.categories.forEach(cat=>{
      const select=document.getElementById(cat.id);
      if(!select) return;
      select.innerHTML='';
      const ph=document.createElement('option');
      ph.value=''; ph.textContent=cat.label||'Select';
      select.appendChild(ph);
      if(Array.isArray(cat.links)){
        const frag=document.createDocumentFragment();
        cat.links.forEach(link=>{
          if(!link||!link.url||!link.name) return;
          const opt=document.createElement('option');
          opt.value=link.url; opt.textContent=link.name;
          frag.appendChild(opt);
        });
        select.appendChild(frag);
      }
    });
  };

  // ---------- Notify ----------
  projLib.notifyUser=function(msg){
    const t=document.getElementById('notification');
    if(!t) return;
    t.textContent=msg;
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'),4000);
  };

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded',function(){
    // Theme init
    let theme='dark';
    try{
      const saved=localStorage.getItem('theme');
      if(saved && THEME_LIST.includes(saved)) theme=saved;
    }catch{}
    themeIndex=THEME_LIST.indexOf(theme);
    projLib.applyTheme(theme);

    // Ticker
    projLib.updateTicker();
    setInterval(projLib.updateTicker, 600000);

    // Load hub and home
    projLib.loadHubData('./hubData.json')
      .then(()=>{ if(DEFAULT_HOME) projLib.processLoadUrl(DEFAULT_HOME); })
      .catch(()=>{}); // notify already handled

    // Events
    const dropdownRow=document.querySelector('.row.dropdowns');
    if(dropdownRow){
      dropdownRow.addEventListener('change',function(ev){
        if(ev.target && ev.target.tagName.toLowerCase()==='select' && ev.target.value){
          projLib.processLoadUrl(ev.target.value);
          ev.target.selectedIndex=0;
        }
      });
    }

    const form=document.getElementById('proxyForm');
    if(form){
      form.addEventListener('submit',function(e){
        e.preventDefault();
        const t=document.getElementById('urlInput');
        if(t) projLib.processLoadUrl(t.value);
      });
    }

    const home=document.getElementById('homeBtn');
    if(home){ home.addEventListener('click',()=>{ if(DEFAULT_HOME) projLib.processLoadUrl(DEFAULT_HOME); }); }

    const refresh=document.getElementById('refreshBtn');
    if(refresh){ refresh.addEventListener('click',()=>{
      const c=document.getElementById('currentUrl');
      if(c && c.value) projLib.processLoadUrl(c.value);
    }); }

    const themeBtn=document.getElementById('toggleTheme');
    if(themeBtn){ themeBtn.addEventListener('click',projLib.toggleTheme); }

    const mask=document.getElementById('maskTab');
    if(mask){
      mask.addEventListener('change',function(ev){
        if(!ev.target.value) return;
        const [title,iconUrl]=ev.target.value.split('|');
        if(title) document.title=title;
        if(iconUrl){
          let link=document.querySelector('link[rel~="icon"]');
          if(!link){ link=document.createElement('link'); link.rel='icon'; document.head.appendChild(link); }
          link.href=iconUrl;
        }
        ev.target.selectedIndex=0;
      });
    }

    startUrlPoll();
  });

  window.projLib=projLib;
})(window.projLib||{});
