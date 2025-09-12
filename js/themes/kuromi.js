console.log("Kuromi theme active.");

function spawnKuromi() {
  const img = document.createElement("img");
  img.src = "https://i.imgur.com/X4Qw0y0.png";
  img.classList.add("kuromi-pop");
  img.style.position = "absolute";
  img.style.top = Math.random() * window.innerHeight + "px";
  img.style.left = Math.random() * window.innerWidth + "px";
  img.style.width = "80px";
  img.style.height = "80px";
  img.style.pointerEvents = "none";
  img.style.zIndex = 9999;
  document.body.appendChild(img);

  setTimeout(() => img.remove(), 4000);
}

setInterval(spawnKuromi, 7000);
