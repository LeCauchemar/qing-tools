(async () => {
  applyStyle('island'); applyTheme('dark'); setPinned(true); S.grace = Date.now() + 600000; setMode('idle');
  await new Promise((r) => setTimeout(r, 900));
  return JSON.stringify({ w: Math.round(document.getElementById('island').getBoundingClientRect().width), bg: getComputedStyle(document.querySelector('.surface')).backgroundColor, shadow: getComputedStyle(document.getElementById('island')).boxShadow });
})()
