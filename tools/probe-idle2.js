(() => {
  const r = document.getElementById('island').getBoundingClientRect();
  return JSON.stringify({ mode: S.mode, w: Math.round(r.width), h: Math.round(r.height), r: getComputedStyle(document.getElementById('island')).borderRadius, theme: document.documentElement.dataset.theme, date: el.idleDate && el.idleDate.textContent, sub: el.idleSub && el.idleSub.textContent });
})()
