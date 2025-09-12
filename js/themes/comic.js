console.log("Comic theme active.");

document.body.addEventListener("click", (e) => {
  const pow = document.createElement("div");
  pow.innerText = "POW!";
  pow.style.position = "absolute";
  pow.style.left = e.pageX + "px";
  pow.style.top = e.pageY + "px";
  pow.style.fontSize = "20px";
  pow.style.fontWeight = "bold";
  pow.style.color = "red";
  pow.style.zIndex = 9999;
  document.body.appendChild(pow);

  setTimeout(() => pow.remove(), 800);
});
