(function(projLib){
  'use strict';

  let HUB_DATA=null;
  let DEFAULT_HOME=null;

  // ---------- Utilities ----------
  projLib.isValidUrl=function(e){try{const u=new URL(e.startsWith("http")?e:"https://"+e);return u.hostname.includes(".")||u.hostname==="localhost";}catch{return false;}};
  projLib.sanitizeText=function(e){const t=document.createElement("div");t.textContent=e;return t.innerHTML;};
  projLib.fetchWithTimeout=function(url,opts,timeoutMs){opts=opts||{};timeoutMs=timeoutMs||15000;const c=new AbortController();const t=setTimeout(()=>c.abort(),timeoutMs);return fetch(url,{...opts,signal:c.signal}).then(r=>{clearTimeout(t);return r}).catch(err=>{clearTimeout(t);throw err;});};
  projLib.fetchWithRetry=function(url,opts,retries,timeoutMs){retries=retries===undefined?2:retries;timeoutMs=timeoutMs||15000;return projLib.fetchWithTimeout(url,opts,timeoutMs).catch(err=>{if(retries>0)return projLib.fetchWithRetry(url,opts,retries-1,timeoutMs);throw err;});};

  // ---------- RSS / Ticker ----------
  projLib.fetchRSSFeed=function(feedUrl,cacheMs){cacheMs=cacheMs||600000;return fetch(feedUrl).then(r=>r.text());};

  projLib.updateTicker=function(){
    projLib.fetchRSSFeed("https://www.rtp.pt/noticias/rss/mundo").then(xmlStr=>{
      const parser=new DOMParser();
      const xml=parser.parseFromString(xmlStr,"text/xml");
      const items=xml.getElementsByTagName("item");
      let html="";
      for(let i=0;i<items.length;i++){const t=items[i].getElementsByTagName("title")[0];const l=items[i].getElementsByTagName("link")[0];if(t&&l){html+=`<a href="${l.textContent}" target="_blank">${projLib.sanitizeText(t.textContent)}</a> | `;}}
      if(html.endsWith(" | "))html=html.slice(0,-3);
      const tickerEl=document.querySelector(".ticker");tickerEl.innerHTML=html;
      const containerWidth=document.querySelector(".ticker-container").offsetWidth;
      const contentWidth=tickerEl.scrollWidth;
      if(contentWidth>containerWidth){const d=contentWidth/50;tickerEl.style.animationDuration=d+"s";}else tickerEl.style.animation="none";
    }).catch(()=>{projLib.notifyUser("Failed to load news feed.");document.querySelector(".ticker").innerText="Failed to load news feed."});
  };

  // ---------- UI helpers ----------
  projLib.notifyUser=function(msg){const t=document.getElementById("notification");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),4000);};

  projLib.applyTheme=function(mode){
    document.body.className="";
    document.body.classList.add("theme-"+mode);
  };
  const THEME_LIST=["dark","geek","minimal","kuromi","tech","comic","anime","cyberpunk"];
  let themeIndex=0;
  projLib.toggleTheme=function(){
    themeIndex=(themeIndex+1)%THEME_LIST.length;
    projLib.applyTheme(THEME_LIST[themeIndex]);
  };

  // ---------- Iframe ----------
  projLib.processLoadUrl=function(input){
    let t=(input||"").trim();if(!t)return;
    if(!projLib.isValidUrl(t))t="https://swisscows.com/web?query="+encodeURIComponent(t);
    if(!t.startsWith("http://")&&!t.startsWith("https://"))t="https://"+t;

    const frame=document.getElementById("proxyFrame");
    frame.style.display="block";
    document.getElementById("initialMessage").style.display="none";
    const overlay=document.getElementById("loadingOverlay");
    overlay.style.display="flex";

    frame.onload=function(){overlay.style.display="none";document.getElementById("currentUrl").value=frame.contentWindow.location.href||t;};
    frame.onerror=function(){overlay.style.display="none";projLib.notifyUser("Failed to load the content.");};
    frame.src=t;
  };

  projLib.fullscreenProxy=function(){const e=document.getElementById("proxyFrame");if(e.requestFullscreen)e.requestFullscreen();else if(e.webkitRequestFullscreen)e.webkitRequestFullscreen();else if(e.msRequestFullscreen)e.msRequestFullscreen();};

  // ---------- Dynamic hub loading ----------
  projLib.loadHubData=function(path){
    return projLib.fetchWithRetry(path,{},2,10000)
      .then(resp=>{if(!resp.ok)throw new Error("Failed to fetch hubData.json");return resp.json();})
      .then(data=>{
        HUB_DATA=data;
        if(Array.isArray(data.categories))projLib.populateDropdowns(data);
        if(typeof data.defaultHome==="string")DEFAULT_HOME=data.defaultHome;
        return data;
      }).catch(()=>{projLib.notifyUser("Could not load hub data.");return HUB_DATA||{};});
  };

  projLib.populateDropdowns=function(data){if(!data||!Array.isArray(data.categories))return;data.categories.forEach(cat=>{const select=document.getElementById(cat.id);if(!select)return;select.innerHTML="";const placeholder=document.createElement("option");placeholder.value="";placeholder.textContent=cat.label||"Select";select.appendChild(placeholder);if(Array.isArray(cat.links)){const frag=document.createDocumentFragment();cat.links.forEach(link=>{if(!link||!link.url||!link.name)return;const opt=document.createElement("option");opt.value=link.url;opt.textContent=link.name;frag.appendChild(opt);});select.appendChild(frag);}});};

  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded",function(){
    // default theme
    projLib.applyTheme("dark");
    // ticker
    projLib.updateTicker();setInterval(projLib.updateTicker,600000);
    // load hub
    projLib.loadHubData("./hubData.json").then(()=>{if(DEFAULT_HOME)projLib.processLoadUrl(DEFAULT_HOME);});
    // events
    document.getElementById("proxyForm").addEventListener("submit",function(ev){ev.preventDefault();projLib.processLoadUrl(document.getElementById("urlInput").value);});
    document.getElementById("homeBtn").addEventListener("click",function(){if(DEFAULT_HOME)projLib.processLoadUrl(DEFAULT_HOME);});
    document.getElementById("refreshBtn").addEventListener("click",function(){const e=document.getElementById("currentUrl").value;if(e)projLib.processLoadUrl(e);});
    document.querySelector(".dropdowns-container").addEventListener("change",function(ev){if(ev.target.tagName.toLowerCase()==="select"&&ev.target.value){projLib.processLoadUrl(ev.target.value);ev.target.selectedIndex=0;}});
    document.getElementById("toggleTheme").addEventListener("click",projLib.toggleTheme);
    // Theme effect triggers
function triggerThemeEffects(theme) {
  const container=document.querySelector('.container');
  if(theme==='kuromi'){
    const spark=document.createElement('div');
    spark.className='kuromi-spark';
    spark.style.left=Math.random()*container.offsetWidth+'px';
    spark.style.top=Math.random()*container.offsetHeight+'px';
    container.appendChild(spark);
    setTimeout(()=>spark.remove(),2000);
  }else if(theme==='comic'){
    container.addEventListener('click',function(e){
      const pop=document.createElement('div');
      pop.className='comic-pop';
      pop.style.left=e.offsetX+'px';
      pop.style.top=e.offsetY+'px';
      pop.textContent=Math.random()<0.5?'POW!':'BAM!';
      container.appendChild(pop);
      setTimeout(()=>pop.remove(),600);
    });
  }
}

// Update toggleTheme to include effects
projLib.toggleTheme=function(){
  themeIndex=(themeIndex+1)%THEME_LIST.length;
  const theme=THEME_LIST[themeIndex];
  projLib.applyTheme(theme);
  triggerThemeEffects(theme);
};

    // Tab masking
    document.getElementById("maskTab").addEventListener("change",function(ev){if(!ev.target.value)return;const [title,icon]=ev.target.value.split("|");document.title=title;let link=document.querySelector("link[rel~='icon']");if(!link){link=document.createElement("link");link.rel="icon";document.head.appendChild(link);}link.href=icon;ev.target.selectedIndex=0;});
    // Dynamic URL tracking
    setInterval(()=>{const frame=document.getElementById("proxyFrame");if(frame.contentWindow)document.getElementById("currentUrl").value=frame.contentWindow.location.href||document.getElementById("currentUrl").value;},500);
  });

  window.projLib=projLib;
})(window.projLib||{});
