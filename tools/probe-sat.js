(async () => {
  location.reload();
  await new Promise((r) => setTimeout(r, 3000));
  applyStyle('island'); applyTheme('dark'); setPinned(true); S.grace = Date.now() + 600000; setMode('compact');
  await new Promise((r) => setTimeout(r, 900));
  const s = document.querySelector('.sat.mail');
  const r = s.getBoundingClientRect();
  return JSON.stringify({ css: getComputedStyle(s).backgroundColor, border: getComputedStyle(s).borderTopWidth + ' ' + getComputedStyle(s).borderTopColor, box: [Math.round(r.width), Math.round(r.height)] });
})()
