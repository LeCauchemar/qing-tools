(async () => {
  applyStyle('island'); setPinned(true); setTab('mail'); setMode('panel');
  await new Promise((r) => setTimeout(r, 1200));
  document.getElementById('island').style.setProperty('--isl-r', '224px');
  await new Promise((r) => setTimeout(r, 300));
  return 'ok';
})()
