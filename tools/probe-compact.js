(async () => {
  applyStyle('island'); setPinned(true); S.grace = Date.now() + 600000; setMode('compact');
  await new Promise((r) => setTimeout(r, 1000));
  const q = document.querySelector('.quick');
  const bar = document.querySelector('.view-compact');
  const isl = document.getElementById('island');
  const overflow = Array.from(bar.querySelectorAll('.quick')).some((b) => b.getBoundingClientRect().right > isl.getBoundingClientRect().right - 8);
  return JSON.stringify({ w: Math.round(isl.getBoundingClientRect().width), h: Math.round(isl.getBoundingClientRect().height), radius: getComputedStyle(isl).borderRadius, scrollW: bar.scrollWidth, clientW: bar.clientWidth, overflow });
})()
