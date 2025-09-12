// themes.js
// Handles theme switching and effects
(function(projLib){
  'use strict';

  const THEME_LIST = ['dark','glitch','matrix','kuromi','comic','anime','cyberpunk','minimal'];
  let themeIndex = 0;
  let effectInterval = null;

  projLib.applyTheme = function(theme){
    // Remove old theme classes
    THEME_LIST.forEach(t => document.body.classList.remove('theme-'+t));
    // Add new
    document.body.classList.add('theme-'+theme);
    // Trigger effects
    triggerThemeEffects(theme);
    // Save
    localStorage.setItem('theme', theme);
  };

  projLib.toggleTheme = function(){
    themeIndex = (themeIndex+1)%THEME_LIST.length;
    projLib.applyTheme(THEME_LIST[themeIndex]);
    const btn = document.getElementById('toggleThemeBtn');
    if(btn) btn.textContent = 'Theme: '+THEME_LIST[themeIndex];
  };

  function triggerThemeEffects(theme){
    clearInterval(effectInterval);
    document.querySelectorAll('.fx-element').forEach(el=>el.remove());

    const container = document.querySelector('.console-container');
    if(!container) return;

    if(theme==='matrix'){
      // Falling green characters
      effectInterval = setInterval(()=>{
        const span=document.createElement('span');
        span.className='fx-element matrix-char';
        span.textContent = String.fromCharCode(0x30A0+Math.random()*96);
        span.style.left = Math.random()*100+'%';
        container.appendChild(span);
        setTimeout(()=>span.remove(),2000);
      },100);
    }

    if(theme==='kuromi'){
      // Little kuromis popping
      effectInterval=setInterval(()=>{
        const img=document.createElement('img');
        img.src='assets/kuromi.png';
        img.className='fx-element kuromi-sprite';
        img.style.left=Math.random()*90+'%';
        img.style.top=Math.random()*90+'%';
        container.appendChild(img);
        setTimeout(()=>img.remove(),3000);
      },2000);
    }

    if(theme==='glitch'){
      // Glitch effect overlay
      const glitch=document.createElement('div');
      glitch.className='fx-element glitch-overlay';
      container.appendChild(glitch);
    }
  }

  // Boot theme
  document.addEventListener('DOMContentLoaded', ()=>{
    let theme=localStorage.getItem('theme');
    if(!theme||!THEME_LIST.includes(theme)) theme='dark';
    themeIndex=THEME_LIST.indexOf(theme);
    projLib.applyTheme(theme);
    const btn=document.getElementById('toggleThemeBtn');
    if(btn) btn.textContent='Theme: '+theme;
  });

})(window.ProjLib=window.ProjLib||{});
