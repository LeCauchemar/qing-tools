(async () => {
  applyStyle('island'); applyTheme('dark'); setPinned(true); S.grace = Date.now() + 600000;
  setTab('files'); setMode('panel');
  await new Promise(r=>setTimeout(r,1200));
  const q = document.getElementById('fileQuery');
  q.value = 'package'; q.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
  await new Promise(r=>setTimeout(r,2600));
  const rows = document.querySelectorAll('#fsResults .fs-row').length;
  const info = document.querySelector('#fsResults .fs-info');
  return JSON.stringify({ rows, info: info && info.textContent, mode: S.mode, engine: S.fs.engine, wide: S.fs.wide });
})()
