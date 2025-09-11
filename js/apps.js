(function(projLib){
'use strict';

let HUB_DATA=null,DEFAULT_HOME=null;
const THEME_LIST=['dark','kuromi','comic','cyberpunk','geek','tech','anime','minimal'];
let themeIndex=0,scanlineInterval=null;

// ---------- Utilities ----------
projLib.isValidUrl=e=>{try{const u=new URL(e.startsWith('http')?e:'https://'+e);return u.hostname.includes('.')||u.hostname==='localhost';}catch{return false;}}
projLib.sanitizeText=e=>{const t=document.createElement('div');t.textContent=e;return t.innerHTML;}
projLib.fetchWithTimeout=(url,opts,timeoutMs)=>{opts=opts||{};timeoutMs=timeoutMs||15000;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);return fetch(url,{...opts,signal:controller.signal}).then(resp=>{clearTimeout(timer);return resp;}).catch(err=>{clearTimeout(timer);throw err;});}
projLib.fetchWithRetry=(url,opts,retries,timeoutMs)=>{retries=retries===undefined?2:retries;timeoutMs=timeoutMs||15000;return projLib.fetchWithTimeout(url,opts,timeoutMs).catch(err=>{if(retries>0)return projLib.fetchWithRetry(url,opts,retries-1,timeoutMs);throw err;});}

// ---------- RSS / Ticker ----------
projLib.fetchRSSFeed=(feedUrl,cacheMs)=>{cacheMs=cacheMs||600000;const key='rssFeedCache_'+feedUrl;const cached=localStorage.getItem(key);if(cached){try{const parsed=JSON.parse(cached);if(Date.now()-parsed.timestamp<cacheMs)return Promise.resolve(parsed.data);}catch{}}return projLib.fetchWithRetry(feedUrl).then(resp=>{if(!resp.ok)throw new Error('Network response error');return resp.text();}).then(data=>{localStorage.setItem(key,JSON.stringify({timestamp:Date.now(),data}));return data;});}
projLib.updateTicker=()=>{projLib.fetchRSSFeed('https://www.rtp.pt/noticias/rss/mundo').then(xmlStr=>{const parser=new DOMParser();const xml=parser.parseFromString(xmlStr,'text/xml');const items=xml.getElementsByTagName('item');let html='';for(let i=0;i<items.length;i++){const title=items[i].getElementsByTagName('title')[0];const link=items[i].getElementsByTagName('link')[0];if(title&&link){const safeTitle=projLib.sanitizeText(title.textContent);html+=`<a href="${link.textContent}" target="_blank" style="color: inherit; text-decoration:none; margin-right:20px;">${safeTitle}</a> | `;}}if(html.endsWith(' | '))html=html.slice(0,-3);const tickerEl=document.querySelector('.ticker');tickerEl.innerHTML=html;const containerWidth=document.querySelector('.ticker-container').offsetWidth;const contentWidth=tickerEl.scrollWidth;if(contentWidth>containerWidth){tickerEl.style.animationDuration=(contentWidth/50)+'s';}else{tickerEl.style.animation='none';}}).catch(()=>{document.querySelector('.ticker').innerText='Failed to load news feed.';});}

// ---------- UI Helpers ----------
projLib.notifyUser=msg=>{console.log(msg);}
projLib.applyTheme=mode=>{
  document.body.className='';
  document.body.classList.add('theme-'+mode);
}

// ---------- Theme Effects ----------
function triggerThemeEffects(theme){
  const container=document.querySelector('.console-container');
  if(scanlineInterval){clearInterval(scanlineInterval);scanlineInterval=null;}
  document.querySelectorAll('.theme-effect').forEach(el=>el.remove());

  switch(theme){
    case 'tech':
      scanlineInterval=setInterval(()=>{
        const scan=document.createElement('div');
        scan.className='theme-effect tech-scanline';
        scan.style.top=Math.random()*container.offsetHeight+'px';
        container.appendChild(scan);
        setTimeout(()=>scan.remove(),800);
      },400);
      break;
    case 'kuromi':
      scanlineInterval=setInterval(()=>{
        const k=document.createElement('div');
        k.className='theme-effect kuromi-icon';
        k.style.top=Math.random()*container.offsetHeight+'px';
        k.style.left=Math.random()*container.offsetWidth+'px';
        k.style.backgroundImage='url("https://upload.wikimedia.org/wikipedia/en/d/dc/Kuromi_icon.png")';
        container.appendChild(k);
        setTimeout(()=>k.remove(),2000);
      },500);
      break;
    case 'comic':
      container.addEventListener('click',()=>{container.classList.add('comic-pop');setTimeout(()=>container.classList.remove('comic-pop'),200);});
      break;
    case 'anime':
      container.classList.add('theme-anime-active');
      break;
  }
}
projLib.toggleTheme=()=>{
  themeIndex=(themeIndex+1)%THEME_LIST.length;
  const theme=THEME_LIST[themeIndex];
  projLib.applyTheme(theme);
  triggerThemeEffects(theme);
  const btn=document.getElementById('toggleThemeBtn');
  if(btn)btn.textContent='Theme: '+theme.charAt(0).toUpperCase()+theme.slice(1);
}

// ---------- Iframe ----------
projLib.processLoadUrl=input=>{
  let t=(input||'').trim();
  if(!t)return;
  if(!t.startsWith('http://')&&!t.startsWith('https://')){
    if(/\.\w{2,}/.test(t)) t='https://'+t;
    else t='https://swisscows.com/web?query='+encodeURIComponent(t);
  }
  const frame=document.getElementById('proxyFrame');
  frame.removeAttribute('srcdoc');frame.style.display='block';
  document.getElementById('initialMessage').style.display='none';
  const overlay=document.getElementById('loadingOverlay');overlay.style.display='flex';
  frame.onload=()=>overlay.style.display='none';
  frame.onerror=()=>{overlay.style.display='none';projLib.notifyUser('Failed to load content.');};
  frame.setAttribute('allowfullscreen','true');frame.setAttribute('referrerpolicy','no-referrer');frame.src=t;
}

// ---------- Boot ----------
document.addEventListener('DOMContentLoaded',()=>{
  let theme=localStorage.getItem('theme');if(!theme||!THEME_LIST.includes(theme))theme='dark';
  themeIndex=THEME_LIST.indexOf(theme);projLib.applyTheme(theme);triggerThemeEffects(theme);
  const btn=document.getElementById('toggleThemeBtn');if(btn)btn.textContent='Theme: '+theme.charAt(0).toUpperCase()+theme.slice(1);

  projLib.updateTicker();setInterval(projLib.updateTicker,600000);

  fetch('./hubData.json').then(r=>r.json()).then(data=>{
    HUB_DATA=data;
    DEFAULT_HOME=data.defaultHome;
    projLib.populateDropdowns(data);
    projLib.processLoadUrl(DEFAULT_HOME);
  });

  document.querySelector('.dropdowns-grid').addEventListener('change',ev=>{
    if(ev.target.tagName.toLowerCase()==='select'){
      const val=ev.target.value;if(val)projLib.processLoadUrl(val);ev.target.selectedIndex=0;
    }
  });

  const scannerBtn=document.getElementById('scannerBtn');
  const scannerForm=document.getElementById('scannerForm');
  const urlInput=document.getElementById('urlInput');
  if(scannerBtn)scannerBtn.addEventListener('click',()=>{
    if(scannerForm.classList.contains('hidden')){scannerForm.classList.remove('hidden'); urlInput.focus();}
    else{scannerForm.classList.add('hidden');}
  });
  if(scannerForm){
    scannerForm.addEventListener('submit',e=>{e.preventDefault();projLib.processLoadUrl(urlInput.value);});
  }

  if(btn)btn.addEventListener('click',projLib.toggleTheme);

  const fullscreenBtn=document.getElementById('fullscreenBtn');
  if(fullscreenBtn){fullscreenBtn.addEventListener('click',()=>{const frame=document.getElementById('proxyFrame');if(frame.requestFullscreen)frame.requestFullscreen();});}
});
})(window.ProjLib=window.ProjLib||{});
