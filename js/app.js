(function (projLib) {
  'use strict';

  let HUB_DATA = null;
  let DEFAULT_HOME = "https://archive.org";

  // Themes
  const THEMES = [
    { name: "Dark", vars:{ "--bg-color":"#181818","--text-color":"#eee","--accent-color":"#ffcc00","--button-bg":"#222244","--button-hover":"linear-gradient(45deg, #9d00ff,#00d4ff)" } },
    { name: "Light", vars:{ "--bg-color":"#fff","--text-color":"#222","--accent-color":"#ffaa00","--button-bg":"#eee","--button-hover":"linear-gradient(45deg,#ffaa00,#ff6600)" } },
    { name: "Cyberpunk", vars:{ "--bg-color":"#0d0d20","--text-color":"#f0f0ff","--accent-color":"#ff00aa","--button-bg":"#110033","--button-hover":"linear-gradient(45deg,#ff00aa,#00ffff)" } },
    { name: "Minimal", vars:{ "--bg-color":"#f5f5f5","--text-color":"#222","--accent-color":"#333","--button-bg":"#ddd","--button-hover":"linear-gradient(45deg,#333,#555)" } },
    { name: "Anime", vars:{ "--bg-color":"#ffe6f0","--text-color":"#333","--accent-color":"#ff66aa","--button-bg":"#ffccff","--button-hover":"linear-gradient(45deg,#ff66aa,#ff99cc)" } },
    { name: "Techie", vars:{ "--bg-color":"#101820","--text-color":"#cce7ff","--accent-color":"#00ffcc","--button-bg":"#202830","--button-hover":"linear-gradient(45deg,#00ffcc,#0055aa)" } },
    { name: "Comic", vars:{ "--bg-color":"#fff5e6","--text-color":"#222","--accent-color":"#ff6600","--button-bg":"#ffcc99","--button-hover":"linear-gradient(45deg,#ff6600,#ffcc00)" } },
  ];
  let currentTheme = 0;

  projLib.applyTheme = function(idx) {
    const theme = THEMES[idx];
    if(!theme) return;
    for(const v in theme.vars) document.documentElement.style.setProperty(v,theme.vars[v]);
  };

  projLib.toggleTheme = function(){
    currentTheme = (currentTheme+1)%THEMES.length;
    projLib.applyTheme(currentTheme);
    localStorage.setItem("themeIndex", currentTheme);
  };

  projLib.isValidUrl = function (e) {
    try {
      const u = new URL(e.startsWith("http") ? e : "https://"+e);
      return u.hostname.includes(".")||u.hostname==="localhost";
    } catch { return false; }
  };

  projLib.sanitizeText = function(e){const t=document.createElement("div");t.textContent=e;return t.innerHTML;};

  projLib.updateTicker = function(){
    const tickerEl=document.querySelector(".ticker");
    tickerEl.textContent="Latest news: Feed not available";
  };

  projLib.processLoadUrl = function(input){
    let t=(input||"").trim(); if(!t)return;
    if(!projLib.isValidUrl(t)) t="https://swisscows.com/web?query="+encodeURIComponent(t);
    if(!t.startsWith("http://")&&!t.startsWith("https://")) t="https://"+t;

    document.getElementById("currentUrl").value=t;

    const frame=document.getElementById("proxyFrame");
    frame.removeAttribute("srcdoc");
    frame.style.display="block";
    document.getElementById("initialMessage").style.display="none";

    const overlay=document.getElementById("loadingOverlay");
    overlay.style.display="flex";
    frame.onload=function(){ overlay.style.display="none"; };
    frame.onerror=function(){ overlay.style.display="none"; projLib.notifyUser("Failed to load content."); };

    frame.setAttribute("sandbox","allow-forms allow-scripts allow-same-origin allow-popups");
    frame.src=t;
  };

  projLib.notifyUser=function(msg){
    const t=document.getElementById("notification");
    t.textContent=msg;
    t.classList.add("show");
    setTimeout(()=>t.classList.remove("show"),4000);
  };

  projLib.loadHubData=function(path){
    return fetch(path).then(resp=>resp.ok?resp.json():{}).then(data=>{
      HUB_DATA=data;
      if(Array.isArray(data.categories)) projLib.populateDropdowns(data);
      return data;
    }).catch(()=>{ projLib.notifyUser("Could not load hub data"); return {categories:[]}; });
  };

  projLib.populateDropdowns=function(data){
    if(!data||!Array.isArray(data.categories)) return;
    data.categories.forEach(cat=>{
      const select=document.getElementById(cat.id); if(!select)return;
      select.innerHTML="";
      const placeholder=document.createElement("option");
      placeholder.value=""; placeholder.textContent=cat.label||"Select"; select.appendChild(placeholder);
      if(Array.isArray(cat.links)){
        cat.links.forEach(link=>{
          if(!link||!link.url||!link.name)return;
          const opt=document.createElement("option");
          opt.value=link.url; opt.textContent=link.name;
          select.appendChild(opt);
        });
      }
    });
  };

  document.addEventListener("DOMContentLoaded",function(){
    const storedTheme=parseInt(localStorage.getItem("themeIndex")); 
    currentTheme=isNaN(storedTheme)?0:storedTheme;
    projLib.applyTheme(currentTheme);

    projLib.loadHubData("./hubData.json").then(()=>projLib.processLoadUrl(DEFAULT_HOME));

    document.getElementById("proxyForm").addEventListener("submit",function(ev){
      ev.preventDefault(); projLib.processLoadUrl(document.getElementById("urlInput").value);
    });
    document.getElementById("homeBtn").addEventListener("click",()=>projLib.processLoadUrl(DEFAULT_HOME));
    document.getElementById("refreshBtn").addEventListener("click",()=>projLib.processLoadUrl(document.getElementById("currentUrl").value));
    document.querySelector(".row").addEventListener("change",ev=>{
      if(ev.target.tagName.toLowerCase()==="select"&&ev.target.value){
        projLib.processLoadUrl(ev.target.value);
        ev.target.selectedIndex=0;
      }
    });
    document.getElementById("maskTab").addEventListener("change",ev=>{
      if(!ev.target.value)return;
      const [title,iconUrl]=ev.target.value.split("|");
      document.title=title;
      let link=document.querySelector("link[rel~='icon']");
      if(!link){ link=document.createElement("link"); link.rel="icon"; document.head.appendChild(link); }
      link.href=iconUrl;
      ev.target.selectedIndex=0;
    });

    document.getElementById("toggleTheme").addEventListener("click",projLib.toggleTheme);
  });

  window.projLib=projLib;
})(window.projLib||{});
