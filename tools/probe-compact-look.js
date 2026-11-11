(async () => {
  applyTheme('light');
  setMode('compact');
  await new Promise((r) => setTimeout(r, 900));
  return JSON.stringify({ w: Math.round(document.getElementById('island').getBoundingClientRect().width) });
})()
