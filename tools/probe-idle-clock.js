(async () => {
  applyStyle('island'); applyTheme('light'); setPinned(true); setMode('idle');
  await new Promise((r) => setTimeout(r, 900));
  const r = document.getElementById('island').getBoundingClientRect();
  return JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height), date: el.idleDate.textContent, sub: el.idleSub.textContent, now: el.idleNow.textContent });
})()
