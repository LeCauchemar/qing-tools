new Promise(async (r) => {
  S.grace = Date.now() + 900000;
  setPinned(false);
  if (!S.timers.length) startTimer(12 * 60 + 30);
  setMode('idle');
  await new Promise((x) => setTimeout(x, 900));
  const isl = document.querySelector('#island').getBoundingClientRect();
  const orb = el.timerOrb.getBoundingClientRect();
  r(
    JSON.stringify({
      island: [Math.round(isl.x), Math.round(isl.y), Math.round(isl.width), Math.round(isl.height)],
      orb: [Math.round(orb.x), Math.round(orb.y), Math.round(orb.width), Math.round(orb.height)],
      val: el.timerVal.textContent,
      orbOpacity: getComputedStyle(el.timerOrb).opacity
    })
  );
});
