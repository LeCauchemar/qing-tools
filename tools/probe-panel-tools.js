(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  S.toolsOpen = { timer: true };
  applyToolOpen();
  setTab('tools');
  setMode('panel');
  setPinned(true);
  await wait(700);
  return JSON.stringify({
    open: [...document.querySelectorAll('.tool-card.open')].map((c) => c.dataset.tool),
    timerSum: document.querySelector('#timerSub').textContent,
    idle: document.querySelector('#idleSub').textContent,
    h: document.querySelector('#island').getBoundingClientRect().height,
  });
})()