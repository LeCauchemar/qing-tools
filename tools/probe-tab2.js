(async () => {
  const t = document.querySelectorAll('.tab')[5];
  const before = getComputedStyle(t).color;
  await new Promise(r => setTimeout(r, 1200));
  const after = getComputedStyle(t).color;
  const anims = t.getAnimations().map(a => a.constructor.name + ':' + (a.transitionProperty || a.animationName) + ':' + a.playState);
  t.style.color = 'rgb(1,2,3)';
  const forced = getComputedStyle(t).color;
  t.style.color = '';
  return JSON.stringify({ before, after, anims, forced });
})()
