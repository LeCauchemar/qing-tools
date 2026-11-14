(async () => {
  S.toolsOpen = { dev: true }; applyToolOpen(); S.dvTab = "b64"; devToolsRedraw(); setMode("panel", true); setTab("tools"); S.pointerIn = true;
  const cv = document.createElement("canvas"); cv.width = 800; cv.height = 500;
  const g = cv.getContext("2d"); const im = g.createImageData(800, 500);
  for (let i = 0; i < im.data.length; i += 4) { const v = (Math.random() * 255) | 0; im.data[i] = v; im.data[i+1] = 255 - v; im.data[i+2] = 200; im.data[i+3] = 255; }
  g.putImageData(im, 0, 0);
  const du = cv.toDataURL("image/png");
  el.dvIn.value = du; el.dvIn.dispatchEvent(new Event("input"));
  const mid = { v: S.data.meta.version, duLen: du.length, taLen: el.dvIn.value.length, bar: el.dvSrcText.textContent };
  await dvRun("b64dec");
  return { ...mid, out: S.dvOut.slice(0, 34), img: !el.dvImgWrap.classList.contains("hidden"), taAfter: el.dvIn.value.length };
})()