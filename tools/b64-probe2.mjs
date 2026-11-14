(async () => {
  S.toolsOpen = { dev: true }; applyToolOpen(); setMode("panel", true); setTab("tools"); S.pointerIn = true;
  await new Promise((r) => setTimeout(r, 700));
  el.dvIn.value = "iVBORw0KGgoAAAANSUhEUgAAAHg";
  await dvRun("b64dec");
  const truncated = S.dvOut.slice(0, 100);
  // 3 MB 的 base64：考验渲染是否被截断
  const big = "A".repeat(3 * 1024 * 1024);
  el.dvIn.value = big;
  const t0 = performance.now();
  await dvRun("b64dec");
  const ms = Math.round(performance.now() - t0);
  const shown = el.dvOut.value.length;
  const fullLen = S.dvOut.length;
  // 图片选择路径：模拟一个 File
  const cv = document.createElement("canvas"); cv.width = 64; cv.height = 64;
  cv.getContext("2d").fillRect(0, 0, 64, 64);
  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  const file = new File([blob], "pick.png", { type: "image/png" });
  await dvRunImage(file);
  return { truncated, ms, shown, fullLen, pick: { outLen: S.dvOut.length, head: S.dvOut.slice(0, 30), img: !el.dvImgWrap.classList.contains("hidden"), meta: el.dvImgMeta.textContent } };
})()