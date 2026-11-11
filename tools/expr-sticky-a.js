(() => {
  const p = getComputedStyle(document.querySelector('.paper'));
  const n = getComputedStyle(document.querySelector('.note'));
  const img = document.querySelector('.note img.pic');
  return JSON.stringify({ paper: p.webkitAppRegion || p.getPropertyValue('-webkit-app-region'), note: n.webkitAppRegion || n.getPropertyValue('-webkit-app-region'), imgs: document.querySelectorAll('.note img.pic').length, w: innerWidth, h: innerHeight, handles: document.querySelectorAll('.rz').length });
})()
