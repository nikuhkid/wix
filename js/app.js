(function(projLib){
  'use strict';

  let HUB_DATA=null;
  let BLACKLISTED_DOMAINS=["wix.com","google.com","youtube.com","facebook.com","2ix2.com","sporttvhdonlinetvs.com"];
  let DEFAULT_HOME="https://archive.org";

  const THEMES=[
    {name:"Dark", props:{bg:"#181818", color:"#eee", containerBg:"rgba(20,20,40,0.9)", buttonBg:"#222244", buttonHover:"linear-gradient(45deg,#9d00ff,#00d4ff)", urlBar:"rgba(50,50,70,0.7)"}},
    {name:"Light", props:{bg:"#fff", color:"#222", containerBg:"rgba(255,255,255,0.9)", buttonBg:"#222244", buttonHover:"linear-gradient(45deg,#ffaa00,#ff6600)", urlBar:"#ddd"}},
    {name:"Geeky", props:{bg:"#0f0f1f", color:"#0f0", containerBg:"rgba(0,0,20,0.9)", buttonBg:"#0f0f1f", buttonHover:"linear-gradient(45deg,#0f0,#0ff)", urlBar:"rgba(0,50,0,0.7)"}},
    {name:"Minimalist", props:{bg:"#f5f5f5", color:"#222", containerBg:"#fff", buttonBg:"#ccc", buttonHover:"#aaa", urlBar:"#eee"}},
    {name:"Kuromi", props:{bg:"#1a001a", color:"#f0c", containerBg:"rgba(50,0,50,0.8)", buttonBg:"#2a002a", buttonHover:"linear-gradient(45deg,#ff77ff,#ff00ff)", urlBar:"rgba(80,0,80,0.5)"}},
    {name:"Tech", props:{bg:"#001f2f", color:"#0ff", containerBg:"rgba(0,31,47,0.9)", buttonBg:"#001f2f", buttonHover:"linear-gradient(45deg,#0ff,#0f0)", urlBar:"rgba(0,31,47,0.7)"}},
    {name:"Comic", props:{bg:"#fffcf0", color:"#222", containerBg:"#fff5e0", buttonBg:"#ffcc00", buttonHover:"#ff8800", urlBar:"#ffeedd"}},
    {name:"Anime", props:{bg:"#f0f0f8", color:"#222", containerBg:"rgba(240,240,248,0.9)", buttonBg:"#a855f7", buttonHover:"linear-gradient(45deg,#f0a,#55f)", urlBar:"rgba(200,180,255,0.7)"}},
    {name:"Cyberpunk", props:{bg:"#0a0a1f", color:"#0ff", containerBg:"rgba(10,10,31,0.9)", buttonBg:"#0a0a1f", buttonHover:"linear-gradient(45deg,#0ff,#f0f)", urlBar:"rgba(0,20,40,0.7)"}}
  ];

  let themeIndex=0;

  projLib.applyTheme=function(idx){
    const theme=THEMES[idx||0];
    document.body.style.background=theme.props.bg;
    document.body.style.color=theme.props.color;
    const container=document.querySelector(".container");
    container.style.background=theme.props.containerBg;
    const buttons=document.querySelectorAll("button");
    buttons.forEach(btn=>{btn.style.background=theme.props.buttonBg; btn.style.color=theme.props.color; btn.onmouseover=()=>btn.style.background=theme.props.buttonHover; btn.onmouseout=()=>btn.style.background=theme.props.buttonBg;});
    document.getElementById("currentUrl").style.background=theme.props.urlBar;
    document.getElementById("toggleTheme").textContent="Theme: "+theme.name;
  };

  projLib.toggleTheme=function(){
    themeIndex=(themeIndex+1)%THEMES.length;
    localStorage.setItem("themeIndex",themeIndex);
    projLib.applyTheme(themeIndex);
  };

  projLib.isValidUrl=function(e){
    try{const u=new URL(e.startsWith("http")?e:"https://"+e); return u.hostname.includes(".")||u.hostname==="localhost";}catch{return false;}
  };

  projLib.sanitizeText=function(e){const t=document.createElement("div"); t.textContent=e; return t.innerHTML;};

  projLib.notifyUser=function(msg){const t=document.getElementById("notification"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),4000);};

  projLib.processLoadUrl=function(input){
    let t=(input||"").trim();
    if(!t) return;
    if(!projLib.isValidUrl(t)) t="https://swisscows.com/web?query="+encodeURIComponent(t);
    if(!t.startsWith("http://")&&!t.startsWith("https://")) t="https://"+t;

    const frame=document.getElementById("proxyFrame");
    frame.removeAttribute("srcdoc");
    frame.style.display="block";
    document.getElementById("initialMessage").style.display="none";

    const overlay=document.getElementById("loadingOverlay");
    overlay.style.display="flex";
    frame.onload=function(){overlay.style.display="none"; projLib.updateCurrentUrl();};
    frame.onerror=function(){overlay.style.display="none"; projLib.notifyUser("Failed to load the content."); projLib.updateCurrentUrl();};

    const parsedUrl=new URL(t);
    const isBlacklisted=(BLACKLISTED_DOMAINS||[]).some(d=>parsedUrl.hostname.endsWith(d));
    if(isBlacklisted) frame.setAttribute('sandbox','allow-forms allow-scripts allow-same-origin allow-popups');
    else frame.setAttribute('sandbox','allow-forms allow-scripts allow-same-origin allow-popups');

    frame.src=t;
    projLib.updateCurrentUrl();
  };

  projLib.updateCurrentUrl=function(){
    const frame=document.getElementById("proxyFrame");
    const urlInput=document.getElementById("currentUrl");
    try{urlInput.value=frame.contentWindow.location.href;}catch{urlInput.value=frame.src;}
  };

  projLib.fullscreenProxy=function(){const e=document.getElementById("proxyFrame"); if(e.requestFullscreen)e.requestFullscreen(); else if(e.webkitRequestFullscreen)e.webkitRequestFullscreen(); else if(e.msRequestFullscreen)e.msRequestFullscreen();};

  projLib.loadHubData=function(path){const cacheKey="hubDataCache"; const cached=localStorage.getItem(cacheKey); if(cached){try{HUB_DATA=JSON.parse(cached);}catch{HUB_DATA=null;}} return fetch(path).then(resp=>{if(!resp.ok)throw new Error("Failed to fetch hubData.json");return resp.json();}).then(data=>{HUB_DATA=data; localStorage.setItem(cacheKey,JSON.stringify(data)); if(Array.isArray(data.blacklistedDomains))BLACKLISTED_DOMAINS=data.blacklistedDomains; if(typeof data.defaultHome==="string"&&data.defaultHome)DEFAULT_HOME=data.defaultHome; return data;}).catch(()=>{if(!HUB_DATA)projLib.notifyUser("Could not load hub data; using defaults."); return HUB_DATA||{categories:[]};});};

  projLib.populateDropdowns=function(data){if(!data||!Array.isArray(data.categories))return; data.categories.forEach(cat=>{const select=document.getElementById(cat.id); if(!select)return; select.innerHTML=""; const placeholder=document.createElement("option"); placeholder.value=""; placeholder.textContent=cat.label||"Select"; select.appendChild(placeholder); if(Array.isArray(cat.links)){const frag=document.createDocumentFragment(); cat.links.forEach(link=>{if(!link||!link.url||!link.name)return; const opt=document.createElement("option"); opt.value=link.url; opt.textContent=link.name; frag.appendChild(opt);}); select.appendChild(frag);}});};

  document.addEventListener("DOMContentLoaded",function(){
    const savedThemeIndex=parseInt(localStorage.getItem("themeIndex"));
    themeIndex=isNaN(savedThemeIndex)?0:savedThemeIndex;
    projLib.applyTheme(themeIndex);

    // Ticker
    projLib.updateTicker=function(){document.querySelector(".ticker").innerText="Latest news: (dynamic feed placeholder)";};
    projLib.updateTicker();

    projLib.loadHubData("./hubData.json").then(data=>{projLib.populateDropdowns(data); projLib.processLoadUrl(DEFAULT_HOME);});

    document.getElementById("proxyForm").addEventListener("submit",function(ev){ev.preventDefault(); const t=document.getElementById("urlInput").value; projLib.processLoadUrl(t);});
    document.getElementById("homeBtn").addEventListener("click",()=>projLib.processLoadUrl(DEFAULT_HOME));
    document.getElementById("refreshBtn").addEventListener("click",()=>projLib.processLoadUrl(document.getElementById("currentUrl").value));

    document.querySelector(".row").addEventListener("change",function(ev){if(ev.target.tagName.toLowerCase()==="select"&&ev.target.value){projLib.processLoadUrl(ev.target.value); ev.target.selectedIndex=0;}});

    document.getElementById("maskTab").addEventListener("change",function(ev){
      if(!ev.target.value) return;
      const [title, iconUrl]=ev.target.value.split("|");
      document.title=title;
      let link=document.querySelector("link[rel~='icon']");
      if(!link){link=document.createElement("link"); link.rel="icon"; document.head.appendChild(link);}
      link.href=iconUrl;
      ev.target.selectedIndex=0;
    });

    document.getElementById("toggleTheme").addEventListener("click",projLib.toggleTheme);

    setInterval(projLib.updateCurrentUrl,1000);
  });

  window.projLib=projLib;
})(window.projLib||{});
