(async () => {
  setPinned(true); S.grace = Date.now() + 600000; setMode('idle');
  await new Promise((r) => setTimeout(r, 900));
  const b = document.getElementById('island').getBoundingClientRect();
  return JSON.stringify({ style: document.getElementById('stage').dataset.style, mode: S.mode, w: Math.round(b.width), h: Math.round(b.height), r: getComputedStyle(document.getElementById('island')).borderRadius });
})()
