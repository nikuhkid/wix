// ui.js
// Handles DOM events, iframe, scanner, dropdowns
(function(projLib){
  'use strict';

  projLib.notifyUser = function(msg){
    const t=document.getElementById('notification');
    t.textContent=msg;
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'),4000);
  };

  projLib.processLoadUrl=function(input){
    let t=(input||'').trim();
    if(!t) return;
    if(!t.startsWith('http://') && !t.startsWith('https://')){
      if(/\.\w{2,}/.test(t)) t='https://'+t;
      else t='https://swisscows.com/web?query='+encodeURIComponent(t);
    }

    const frame=document.getElementById('proxyFrame');
    document.getElementById('initialMessage').style.display='none';
    const overlay=document.getElementById('loadingOverlay');
    overlay.style.display='flex';

    frame.onload=()=>overlay.style.display='none';
    frame.onerror=()=>{overlay.style.display='none';projLib.notifyUser('Failed to load content.');};
    frame.src=t;
  };

  projLib.populateDropdowns=function(data){
    if(!data||!Array.isArray(data.categories)) return;
    data.categories.forEach(cat=>{
      const select=document.getElementById(cat.id);
      if(!select) return;
      select.innerHTML='';
      const placeholder=document.createElement('option');
      placeholder.value=''; placeholder.textContent=cat.label||'Select';
      select.appendChild(placeholder);
      if(Array.isArray(cat.links)){
        cat.links.forEach(link=>{
          if(!link.url||!link.name) return;
          const opt=document.createElement('option');
          opt.value=link.url; opt.textContent=link.name;
          select.appendChild(opt);
        });
      }
    });
  };

  document.addEventListener('DOMContentLoaded', ()=>{
    // Scanner toggle
    const scannerBtn=document.getElementById('scannerBtn');
    const scannerForm=document.getElementById('scannerForm');
    const urlInput=document.getElementById('urlInput');
    scannerBtn.addEventListener('click',()=>{
      scannerForm.classList.toggle('hidden');
      if(!scannerForm.classList.contains('hidden')) urlInput.focus();
    });
    scannerForm.addEventListener('submit',e=>{
      e.preventDefault();
      projLib.processLoadUrl(urlInput.value);
    });

    // Dropdowns
    document.querySelector('.dropdowns-grid').addEventListener('change',ev=>{
      if(ev.target.tagName.toLowerCase()==='select'){
        const val=ev.target.value;
        if(val) projLib.processLoadUrl(val);
        ev.target.selectedIndex=0;
      }
    });

    // Buttons
    document.getElementById('homeBtn').addEventListener('click',()=>projLib.processLoadUrl('./'));
    document.getElementById('refreshBtn').addEventListener('click',()=>location.reload());
    document.getElementById('fullscreenBtn').addEventListener('click',()=>{
      const frame=document.getElementById('proxyFrame');
      if(frame.requestFullscreen) frame.requestFullscreen();
    });

    // Load hub
    projLib.loadHubData('./hubData.json').then(data=>{
      projLib.populateDropdowns(data);
      if(data.defaultHome) projLib.processLoadUrl(data.defaultHome);
    });
  });

})(window.ProjLib=window.ProjLib||{});
