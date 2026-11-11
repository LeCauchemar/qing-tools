(async () => {
  applyTheme('light');
  setMode('compact');
  await new Promise((r) => setTimeout(r, 800));
  const v = document.querySelector('.view-compact');
  const w0 = document.getElementById('island').getBoundingClientRect().width;
  setMode('idle');
  await new Promise((r) => setTimeout(r, 160));
  const cs = getComputedStyle(v);
  const w1 = document.getElementById('island').getBoundingClientRect().width;
  document.getElementById('island').style.animationPlayState = 'paused';
  return JSON.stringify({ w0: Math.round(w0), w1: Math.round(w1), transform: cs.transform, opacity: cs.opacity });
})()
