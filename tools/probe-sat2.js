(async () => {
  applyStyle('island'); applyTheme('dark'); setPinned(true); S.grace = Date.now() + 600000; setMode('compact');
  await new Promise((r) => setTimeout(r, 900));
  return document.querySelectorAll('.sat').length + '|' + Array.from(document.querySelectorAll('.sat')).map(s=>s.className).join(',');
})()
