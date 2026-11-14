(async () => {
  S.toolsOpen = { dev: true }; applyToolOpen(); S.dvTab = "b64"; devToolsRedraw(); setMode("panel", true); setTab("tools"); S.pointerIn = true;
  const cv = document.createElement("canvas"); cv.width = 100; cv.height = 60;
  cv.getContext("2d").fillStyle = "#29d3c0"; cv.getContext("2d").fillRect(0, 0, 100, 60);
  el.dvIn.value = cv.toDataURL("image/png");
  await dvRun("b64dec");
  return { v: S.data.meta.version, out: S.dvOut.slice(0, 40), img: !el.dvImgWrap.classList.contains("hidden"), save: !el.dvSave.classList.contains("hidden"), tabs: Array.from(document.querySelectorAll("#dvTabs .dv-tab")).map((b) => b.textContent.trim()) };
})()