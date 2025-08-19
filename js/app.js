(function(projLib){
'use strict';

let HUB_DATA=null;
let BLACKLISTED_DOMAINS=["wix.com","google.com","youtube.com","facebook.com"];
let DEFAULT_HOME="https://archive.org";

projLib.isValidUrl=function(e){
  try{const u=new URL(e.startsWith("http")?e:"https://"+e); return u.hostname.includes(".")||u.hostname==="localhost";}catch{return false;}
};

projLib.sanitizeText=function(e){const t=document.createElement("div");t.textContent=e;return t.innerHTML;};

projLib.fetchWithTimeout=function(url,opts,timeoutMs){
  opts=opts||{}; timeoutMs=timeoutMs||15000;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  return fetch(url,{...opts,signal:controller.signal}).then(r=>{clearTimeout(timer); return r;}).catch(err=>{clearTimeout(timer); throw err;});
};

projLib.fetchWithRetry=function(url,opts,retries,timeoutMs){
  retries=retries===undefined?2:retries;
  timeoutMs=timeoutMs||15000;
  return projLib.fetchWithTimeout(url,opts,timeoutMs).catch(err=>{if(retries>0)return projLib.fetchWithRetry(url,opts,retries-1,timeoutMs); throw err;});
};

// ---------- UI helpers ----------
projLib.notifyUser=function(msg){
  const t=document.getElementById("notification");
  t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),4000);
};

projLib.applyTheme=function(mode){
  document.body.classList.remove(...document.body.classList); // reset
  if(mode && mode!=="dark") document.body.classList.add(mode);
};

projLib.cycleThemeIndex=0;
projLib.THEMES=["dark","light","geek","minimal","kuromi","tech","comic","anime","cyberpunk"];
projLib.toggleTheme=function(){
  projLib.cycleThemeIndex=(projLib.cycleThemeIndex+1)%projLib.THEMES.length;
  const t=projLib.THEMES[projLib.cycleThemeIndex];
  projLib.applyTheme(t);
  localStorage.setItem("theme",t);
};

// ---------- Iframe ----------
projLib.processLoadUrl=function(input){
  let t=(input||"").trim();
  if(!t) return;
  if(!projLib.isValidUrl(t)) t="https://swisscows.com/web?query="+encodeURIComponent(t);
  if(!t.startsWith("http://")&&!t.startsWith("https://")) t="https://"+t;

  const frame=document.getElementById("proxyFrame");
  frame.removeAttribute("srcdoc"); frame.style.display="block";
  document.getElementById("initialMessage").style.display="none";
  document.getElementById("currentUrl").value=t;

  const overlay=document.getElementById("loadingOverlay"); overlay.style.display="flex";
  frame.onload=function(){ overlay.style.display="none"; projLib.updateCurrentUrl(frame); };
  frame.onerror=function(){ overlay.style.display="none"; projLib.notifyUser("Failed to load content."); };

  const parsedUrl=new URL(t);
  const isBlacklisted=(BLACKLISTED_DOMAINS||[]).some(domain=>parsedUrl.hostname.endsWith(domain));
  if(isBlacklisted){ frame.setAttribute("sandbox","allow-forms allow-scripts allow-same-origin allow-popups"); }
  else frame.removeAttribute("sandbox");

  frame.src=t;
};

projLib.updateCurrentUrl=function(frame){
  try{ document.getElementById("currentUrl").value = frame.contentWindow.location.href; }
  catch(e){ /* cross-origin fallback */ }
};

// ---------- Hub / dropdowns ----------
projLib.loadHubData=function(path){
  const cacheKey="hubDataCache";
  const cached=localStorage.getItem(cacheKey);
  if(cached){ try{HUB_DATA=JSON.parse(cached);}catch{} }
  return projLib.fetchWithRetry(path,{},2,10000)
    .then(resp=>{if(!resp.ok)throw new Error("Failed to fetch hubData.json");return resp.json();})
    .then(data=>{HUB_DATA=data; localStorage.setItem(cacheKey,JSON.stringify(data)); return data; })
    .catch(()=>{ if(!HUB_DATA) projLib.notifyUser("Could not load hub data; using defaults."); return HUB_DATA||{categories:[]}; });
};

projLib.populateDropdowns=function(data){
  if(!data||!Array.isArray(data.categories)) return;
  data.categories.forEach(cat=>{
    const select=document.getElementById(cat.id); if(!select) return;
    select.innerHTML="";
    const placeholder=document.createElement("option"); placeholder.value=""; placeholder.textContent=cat.label||"Select";
    select.appendChild(placeholder);
    if(Array.isArray(cat.links)){
      const frag=document.createDocumentFragment();
      cat.links.forEach(link=>{if(!link||!link.url||!link.name) return;
        const opt=document.createElement("option"); opt.value=link.url; opt.textContent=link.name; frag.appendChild(opt);
      });
      select.appendChild(frag);
    }
  });
};

// ---------- Boot ----------
document.addEventListener("DOMContentLoaded",function(){
  let theme=localStorage.getItem("theme")||"dark"; projLib.applyTheme(theme);

  // Load hub data then initialize UI
  projLib.loadHubData("./hubData.json").then(data=>{ projLib.populateDropdowns(data); projLib.processLoadUrl(DEFAULT_HOME); });

  document.getElementById("proxyForm").addEventListener("submit",function(ev){ ev.preventDefault(); projLib.processLoadUrl(document.getElementById("urlInput").value); });
  document.getElementById("homeBtn").addEventListener("click",()=>projLib.processLoadUrl(DEFAULT_HOME));
  document.getElementById("refreshBtn").addEventListener("click",()=>projLib.processLoadUrl(document.getElementById("currentUrl").value));

  document.querySelector(".dropdowns-container").addEventListener("change",function(ev){
    if(ev.target.tagName.toLowerCase()==="select"&&ev.target.value){ projLib.processLoadUrl(ev.target.value); ev.target.selectedIndex=0; }
  });

  document.getElementById("maskTab").addEventListener("change",function(ev){
    if(!ev.target.value) return;
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
