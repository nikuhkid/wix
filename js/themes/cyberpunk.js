console.log("Cyberpunk theme active.");

// Flickering neon effect
setInterval(() => {
  document.querySelectorAll(".console-container, h1, button").forEach(el => {
    el.style.textShadow = Math.random() > 0.5 ? "0 0 8px #0ff" : "none";
  });
}, 300);
