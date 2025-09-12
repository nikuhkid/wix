const themes = [
  "dark", "glitch", "matrix", "kuromi", 
  "comic", "anime", "cyberpunk", "minimal"
];

let currentThemeIndex = 0;
let activeScript = null;

function setTheme(name) {
  // Swap CSS
  const themeLink = document.getElementById("theme-stylesheet");
  themeLink.setAttribute("href", `css/themes/${name}.css`);

  // Unload old JS
  if (activeScript) {
    document.body.removeChild(activeScript);
    activeScript = null;
  }

  // Load new JS if exists
  fetch(`js/themes/${name}.js`)
    .then(res => {
      if (res.ok) {
        const script = document.createElement("script");
        script.src = `js/themes/${name}.js`;
        script.defer = true;
        document.body.appendChild(script);
        activeScript = script;
      }
    })
    .catch(() => {
      console.log(`[ThemeManager] No extra JS for ${name}.`);
    });
}

document.getElementById("theme-toggle").addEventListener("click", () => {
  currentThemeIndex = (currentThemeIndex + 1) % themes.length;
  setTheme(themes[currentThemeIndex]);
});

// Initialize default
setTheme(themes[currentThemeIndex]);
