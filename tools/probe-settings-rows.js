(async () => {
  setPinned(true);
  setTab('settings');
  setMode('panel');
  await new Promise((r) => setTimeout(r, 1200));
  const b = document.querySelectorAll('.setting b');
  return JSON.stringify({ rows: [...b].map((n) => n.textContent), cloud: !!document.getElementById('cloudSub'), ver: S.data.meta.version });
})()
