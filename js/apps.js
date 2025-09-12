(function(projLib){
  'use strict';

  let HUB_DATA = null;
  let DEFAULT_HOME = null;
  const THEME_LIST = ['dark','glitch','matrix','kuromi','comic','anime','cyberpunk','minimal'];
  let themeIndex = 0;

  // --- Utils ---
  projLib.isValidUrl = function(e){
    try {
      const u = new URL(e.startsWith('http') ? e : 'https://' + e);
      return u.hostname.includes('.') || u.hostname === 'localhost';
    } catch { return false; }
  };

  projLib.notifyUser = function(msg){
    const t = document.getElementById('notification');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'),4000);
  };

  // --- Iframe loader ---
  projLib.processLoadUrl = function(input){
    let t = (input||'').trim();
    if(!t) return;
    if(!t.startsWith('http://') && !t.startsWith('https://')){
      if(/\.\w{2,}/.test(t)) t='https://'+t;
      else t='https://swisscows.com/web?query='+encodeURIComponent(t);
    }

    const frame = document.getElementById('proxyFrame');
    document.getElementById('initialMessage').style.display='none';
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display='flex';
    frame.onload = function(){ overlay.style.display='none'; };
    frame.onerror = function(){ overlay.style.display='none'; projLib.notifyUser('Failed to load.'); };
    frame.setAttribute('allowfullscreen', 'true');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.src = t;
  };

  // --- Hub data ---
  projLib.loadHubData = function(path){
    return fetch(path).then(r=>r.json())
      .then(data=>{
        HUB_DATA = data;
        if(typeof data.defaultHome==='string') DEFAULT_HOME=data.defaultHome;
        projLib.populateDropdowns(data);
        if(DEFAULT_HOME) projLib.processLoadUrl(DEFAULT_HOME);
      })
      .catch(()=>projLib.notifyUser('Could not load hubData.json'));
  };

  projLib.populateDropdowns = function(data){
    if(!data||!Array.isArray(data.categories)) return;
    data.categories.forEach(cat=>{
      const select = document.getElementById(cat.id);
      if(!select) return;
      select.innerHTML='';
      const placeholder=document.createElement('option');
      placeholder.value=''; placeholder.textContent=cat.label||'Select';
      select.appendChild(placeholder);
      if(Array.isArray(cat.links)){
        cat.links.forEach(link=>{
          if(!link||!link.url||!link.name) return;
          const opt=document.createElement('option');
          opt.value=link.url; opt.textContent=link.name;
          select.appendChild(opt);
        });
      }
      select.addEventListener('change', e=>{
        if(e.target.value) projLib.processLoadUrl(e.target.value);
        e.target.selectedIndex=0;
      });
    });
  };

  // --- Themes (from before) ---
  projLib.applyTheme = function(mode){
    THEME_LIST.forEach(t => document.body.classList.remove('theme-'+t));
    document.body.classList.add('theme-'+mode);
  };

  projLib.toggleTheme = function(){
    themeIndex = (themeIndex+1)%THEME_LIST.length;
    const theme = THEME_LIST[themeIndex];
    projLib.applyTheme(theme);
    const btn = document.getElementById('toggleThemeBtn');
    if(btn) btn.textContent = 'Theme: '+theme.charAt(0).toUpperCase()+theme.slice(1);
  };

  // --- Boot ---
  document.addEventListener('DOMContentLoaded', ()=>{
    let theme = localStorage.getItem('theme');
    if(!theme||!THEME_LIST.includes(theme)) theme='dark';
    themeIndex=THEME_LIST.indexOf(theme);
    projLib.applyTheme(theme);

    // Theme button
    const themeBtn=document.getElementById('toggleThemeBtn');
    if(themeBtn) themeBtn.addEventListener('click', projLib.toggleTheme);

    // Scanner toggle
    const scannerBtn=document.getElementById('scannerBtn');
    const scannerForm=document.getElementById('scannerForm');
    const urlInput=document.getElementById('urlInput');
    if(scannerBtn && scannerForm){
      scannerBtn.addEventListener('click', ()=>{
        scannerForm.classList.toggle('hidden');
        if(!scannerForm.classList.contains('hidden')) urlInput.focus();
      });
      scannerForm.addEventListener('submit', e=>{
        e.preventDefault();
        projLib.processLoadUrl(urlInput.value);
      });
    }

    // Action buttons
    document.getElementById('homeBtn').addEventListener('click', ()=>{ if(DEFAULT_HOME) projLib.processLoadUrl(DEFAULT_HOME); });
    document.getElementById('refreshBtn').addEventListener('click', ()=>{
      const frame=document.getElementById('proxyFrame');
      if(frame.src) frame.src=frame.src;
    });
    document.getElementById('fullscreenBtn').addEventListener('click', ()=>{
      const frame=document.getElementById('proxyFrame');
      if(frame.requestFullscreen) frame.requestFullscreen();
    });

    // Load hub data
    projLib.loadHubData('./hubData.json');
  });

})(window.ProjLib=window.ProjLib||{});
