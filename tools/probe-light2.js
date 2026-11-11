(async () => {
  applyStyle('island'); applyTheme('light'); setPinned(true); S.grace = Date.now() + 600000;
  setTab('files'); setMode('panel');
  await new Promise(r=>setTimeout(r,1000));
  return JSON.stringify({ theme: document.documentElement.dataset.theme, bg: getComputedStyle(document.querySelector('.surface')).backgroundColor, r: getComputedStyle(document.getElementById('island')).borderRadius });
})()
