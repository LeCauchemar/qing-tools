(async () => {
  S.toolsOpen = { dev: true }; applyToolOpen(); setMode("panel", true); setTab("tools"); S.pointerIn = true;
  await new Promise((r) => setTimeout(r, 700));
  const cv = document.createElement("canvas"); cv.width = 120; cv.height = 80;
  const ctx = cv.getContext("2d"); ctx.fillStyle = "#ff6f91"; ctx.fillRect(0, 0, 120, 80);
  ctx.fillStyle = "#fff"; ctx.font = "20px sans-serif"; ctx.fillText("OK", 32, 48);
  const dataUrl = cv.toDataURL("image/png");
  el.dvIn.value = dataUrl;
  await dvRun("b64dec");
  const t1 = { out: S.dvOut.slice(0, 80), imgShown: !el.dvImgWrap.classList.contains("hidden"), src: (el.dvImg.getAttribute("src") || "").slice(0, 22), save: !el.dvSave.classList.contains("hidden"), meta: el.dvImgMeta.textContent };
  el.dvIn.value = "iVBORw0KGgoAAAANSUhEUgAAAHg";
  await dvRun("b64dec");
  const t2 = { out: S.dvOut.slice(0, 90) };
  el.dvIn.value = "aGVsbG8=";
  await dvRun("b64dec");
  const t3 = { out: S.dvOut };
  el.dvIn.value = "!!!!not base64!!!!";
  await dvRun("b64dec");
  const t4 = { out: S.dvOut.slice(0, 90) };
  return { t1, t2, t3, t4 };
})()