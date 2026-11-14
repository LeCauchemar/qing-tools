(async () => {
  S.toolsOpen = { dev: true }; applyToolOpen(); S.dvTab = "b64"; devToolsRedraw(); setMode("panel", true); setTab("tools"); S.pointerIn = true;
  await new Promise((r) => setTimeout(r, 600));
  // 造一段 1.5 MB 的“图片 base64”（真实图片会更大，这里只验证文本体积）
  const cv = document.createElement("canvas"); cv.width = 900; cv.height = 600;
  const g = cv.getContext("2d"); g.fillStyle = "#2b2f3a"; g.fillRect(0, 0, 900, 600);
  g.fillStyle = "#ff6f91"; g.fillRect(60, 60, 780, 480);
  const dataUrl = cv.toDataURL("image/png");
  const big = ("data:image/png;base64," + dataUrl.split(",")[1]).repeat(3);
  const t0 = performance.now();
  el.dvIn.value = big;
  el.dvIn.dispatchEvent(new Event("input"));
  const ingest = Math.round(performance.now() - t0);
  const afterIngest = { taLen: el.dvIn.value.length, srcLen: S.dvSrc.length, barHidden: el.dvSrcBar.classList.contains("hidden"), barText: el.dvSrcText.textContent };
  const t1 = performance.now();
  await dvRun("b64dec");
  const decodeMs = Math.round(performance.now() - t1);
  const afterDecode = { out: S.dvOut.slice(0, 46), img: !el.dvImgWrap.classList.contains("hidden"), taLen: el.dvIn.value.length };
  // 输入延迟：现在 textarea 是空的，敲一下应立刻响应
  const t2 = performance.now();
  el.dvIn.value = "abc"; el.dvIn.dispatchEvent(new Event("input"));
  const typeMs = Math.round((performance.now() - t2) * 100) / 100;
  return { bigLen: big.length, ingest, afterIngest, decodeMs, afterDecode, typeMs, sub: el.devSub.textContent };
})()