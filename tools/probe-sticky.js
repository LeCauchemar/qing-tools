(async () => {
  const fs = document.documentElement.style;
  return JSON.stringify({
    sx: window.screenX, sy: window.screenY,
    w: window.innerWidth, h: window.innerHeight,
    fs: fs.getPropertyValue('--fs'), lh: fs.getPropertyValue('--lh'),
    btns: [...document.querySelectorAll('.tools .tool')].map(b => b.id || b.textContent)
  });
})()
