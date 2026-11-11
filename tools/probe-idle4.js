(async () => {
  applyStyle('island'); setMode('idle');
  await new Promise((r) => setTimeout(r, 900));
  const b = document.getElementById('island').getBoundingClientRect();
  return JSON.stringify({ w: Math.round(b.width), h: Math.round(b.height), r: getComputedStyle(document.getElementById('island')).borderRadius, date: el.idleDate.textContent, sub: el.idleSub.textContent, fs: getComputedStyle(el.idleDate).fontSize + '/' + getComputedStyle(el.idleSub).fontSize });
})()
