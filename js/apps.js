/* ============================================================
   PROJECT: ProjLib Control Node [BETA]
   - This is the canonical apps.js.
   - Do NOT rename file or project title.
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  const proxyFrame = document.getElementById("proxyFrame");
  const currentUrl = document.getElementById("currentUrl");
  const proxyForm = document.getElementById("proxyForm");
  const urlInput = document.getElementById("urlInput");
  const proxyToggle = document.getElementById("proxyToggle");
  const scannerBtn = document.getElementById("scannerBtn");
  const themeBtn = document.getElementById("themeBtn");
  const homeBtn = document.getElementById("homeBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const initialMessage = document.getElementById("initialMessage");
  const loadingOverlay = document.getElementById("loadingOverlay");

  let config = null;

  // Load JSON config
  try {
    const res = await fetch("config.json");
    config = await res.json();
    populateDropdowns(config.categories);
    loadHome(config.defaultHome);
  } catch (err) {
    console.error("Error loading config.json", err);
  }

  // Dropdown population
  function populateDropdowns(categories) {
    categories.forEach(cat => {
      const select = document.getElementById(cat.id);
      if (select) {
        const placeholder = document.createElement("option");
        placeholder.textContent = `-- ${cat.label} --`;
        placeholder.disabled = true;
        placeholder.selected = true;
        select.appendChild(placeholder);

        cat.links.forEach(link => {
          const option = document.createElement("option");
          option.value = link.url;
          option.textContent = link.name;
          select.appendChild(option);
        });

        select.addEventListener("change", e => {
          loadUrl(e.target.value);
        });
      }
    });
  }

  // Load home
  function loadHome(url) {
    loadUrl(url);
  }

  // Load URL into iframe
  function loadUrl(url) {
    if (!url) return;
    initialMessage.style.display = "none";
    loadingOverlay.style.display = "flex";

    setTimeout(() => {
      proxyFrame.src = url;
      currentUrl.value = url;
      loadingOverlay.style.display = "none";
    }, 1000);
  }

  // Proxy form submit
  proxyForm.addEventListener("submit", e => {
    e.preventDefault();
    loadUrl(urlInput.value);
  });

  // Scanner button toggle
  scannerBtn.addEventListener("click", () => {
    proxyForm.classList.toggle("hidden");
  });

  // Theme toggle (simple cycle)
  const themes = ["default", "matrix", "comic", "kuromi"];
  let currentThemeIndex = 0;
  themeBtn.addEventListener("click", () => {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    document.body.dataset.theme = themes[currentThemeIndex];
  });

  // Action buttons
  homeBtn.addEventListener("click", () => loadHome(config.defaultHome));
  refreshBtn.addEventListener("click", () => proxyFrame.contentWindow.location.reload());
  fullscreenBtn.addEventListener("click", () => {
    if (proxyFrame.requestFullscreen) proxyFrame.requestFullscreen();
  });
});
