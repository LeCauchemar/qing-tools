(async () => {
  applyStyle('island'); applyTheme('dark'); setPinned(true); S.grace = Date.now() + 600000;
  setTab('files'); setMode('panel');
  await new Promise(r=>setTimeout(r,1000));
  const q = document.getElementById('fileQuery');
  q.value = 'package'; q.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
  await new Promise(r=>setTimeout(r,2800));
  const rows = document.querySelectorAll('#fsResults .fs-row');
  const checks = document.querySelectorAll('#fsResults .fs-check');
  return JSON.stringify({ rows: rows.length, checks: checks.length, info: (document.querySelector('.fs-info')||{}).textContent, hint: !!document.querySelector('.fs-hint'), mode: S.mode });
})()
