console.log("Anime theme active.");

// Cute mouse trail
document.addEventListener("mousemove", (e) => {
  const trail = document.createElement("div");
  trail.style.position = "absolute";
  trail.style.left = e.pageX + "px";
  trail.style.top = e.pageY + "px";
  trail.style.width = "10px";
  trail.style.height = "10px";
  trail.style.borderRadius = "50%";
  trail.style.background = "pink";
  trail.style.opacity = 0.7;
  trail.style.zIndex = 9999;
  document.body.appendChild(trail);

  setTimeout(() => trail.remove(), 600);
});
