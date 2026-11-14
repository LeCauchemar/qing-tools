(async () => {
  const cv = document.createElement("canvas"); cv.width = 1400; cv.height = 900;
  const g = cv.getContext("2d");
  const img = g.createImageData(1400, 900);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = v; img.data[i + 1] = 255 - v; img.data[i + 2] = (v * 7) & 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const dataUrl = cv.toDataURL("image/png");
  const t0 = performance.now();
  el.dvIn.value = dataUrl;
  el.dvIn.dispatchEvent(new Event("input"));
  const ingest = Math.round(performance.now() - t0);
  const mid = { taLen: el.dvIn.value.length, srcLen: S.dvSrc.length, barShown: !el.dvSrcBar.classList.contains("hidden"), bar: el.dvSrcText.textContent };
  const t1 = performance.now();
  await dvRun("b64dec");
  const decodeMs = Math.round(performance.now() - t1);
  const after = { out: S.dvOut.slice(0, 40), img: !el.dvImgWrap.classList.contains("hidden"), meta: el.dvImgMeta.textContent, taLen: el.dvIn.value.length, bar: el.dvSrcText.textContent };
  const t2 = performance.now();
  for (let i = 0; i < 20; i++) { el.dvIn.value += "a"; el.dvIn.dispatchEvent(new Event("input")); }
  const typeMs = Math.round(performance.now() - t2);
  return { dataUrlLen: dataUrl.length, ingest, mid, decodeMs, after, type20: typeMs, sub: el.devSub.textContent };
})()