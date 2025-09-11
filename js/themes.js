(function(projLib){
  'use strict';

  const THEME_LIST=['dark','kuromi','comic','cyberpunk','geek','tech','anime','minimal'];
  let themeIndex=0;
  let effectIntervals={};

  function clearThemeEffects(){
    Object.values(effectIntervals).forEach(i=>clearInterval(i));
    effectIntervals={};
    document.querySelectorAll('.theme-effect').forEach(el=>el.remove());
    document.removeEventListener('click',spawnComicPop);
  }

  function spawnKuromi(){
    const el=document.createElement('div');
    el.className='kuromi-icon theme-effect';
    el.style.top=Math.random()*window.innerHeight+'px';
    el.style.left=Math.random()*window.innerWidth+'px';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),1500);
  }

  function spawnComicPop(){
    const el=document.createElement('div');
    el.className='comic-pop theme-effect';
    el.style.top=Math.random()*window.innerHeight+'px';
    el.style.left=Math.random()*window.innerWidth+'px';
    el.textContent='POW!';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),1000);
  }

  function spawnScanline(){
    const el=document.createElement('div');
    el.className='tech-scanline theme-effect';
    el.style.top=Math.random()*window.innerHeight+'px';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),800);
  }

  function spawnMatrixChar(){
    const chars='01あカナギΩΨΣ';
    const el=document.createElement('div');
    el.className='matrix-char theme-effect';
    el.textContent=chars[Math.floor(Math.random()*chars.length)];
    el.style.left=Math.random()*window.innerWidth+'px';
    el.style.top='-20px';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),3000);
  }

  function spawnAnimeParticle(){
    const el=document.createElement('div');
    el.className='anime-particle theme-effect';
    el.style.left=Math.random()*window.innerWidth+'px';
    el.style.top=window.innerHeight+'px';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),2000);
  }

  function triggerThemeEffects(theme){
    clearThemeEffects();

    if(theme==='kuromi'){
      effectIntervals.kuromi=setInterval(spawnKuromi,2500);
    }
    if(theme==='comic'){
      document.addEventListener('click',spawnComicPop);
    }
    if(theme==='cyberpunk'){
      const overlay=document.createElement('div');
      overlay.className='cp-overlay theme-effect';
      document.body.appendChild(overlay);
    }
    if(theme==='geek'){
      effectIntervals.geek=setInterval(spawnMatrixChar,150);
    }
    if(theme==='tech'){
      effectIntervals.tech=setInterval(spawnScanline,400);
    }
    if(theme==='anime'){
      effectIntervals.anime=setInterval(spawnAnimeParticle,500);
    }
  }

  projLib.applyTheme=function(mode){
    THEME_LIST.forEach(t=>document.body.classList.remove('theme-'+t));
    document.body.classList.add('theme-'+mode);
    triggerThemeEffects(mode);
  };

  projLib.toggleTheme=function(){
    themeIndex=(themeIndex+1)%THEME_LIST.length;
    const theme=THEME_LIST[themeIndex];
    projLib.applyTheme(theme);
    localStorage.setItem('theme',theme);
    const btn=document.getElementById('toggleThemeBtn');
    if(btn) btn.textContent='Theme: '+theme.charAt(0).toUpperCase()+theme.slice(1);
  };

  document.addEventListener('DOMContentLoaded',()=>{
    let theme=localStorage.getItem('theme');
    if(!theme||!THEME_LIST.includes(theme)) theme='dark';
    themeIndex=THEME_LIST.indexOf(theme);
    projLib.applyTheme(theme);

    const btn=document.getElementById('toggleThemeBtn');
    if(btn) btn.textContent='Theme: '+theme.charAt(0).toUpperCase()+theme.slice(1);
    if(btn) btn.addEventListener('click',projLib.toggleTheme);
  });

})(window.ProjLib=window.ProjLib||{});
