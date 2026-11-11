new Promise(async (r) => {
  S.grace = Date.now() + 600000;
  setPinned(true);
  setMode('panel');
  setTab('tools');
  await new Promise((x) => setTimeout(x, 700));
  document.querySelector('[data-timer="3"]').click();
  await new Promise((x) => setTimeout(x, 500));
  el.timerH.value = '1';
  el.timerM.value = '2';
  el.timerS.value = '3';
  const lbl = timerLabel(timerFromInputs());
  const n1 = el.timerList.children.length;
  const sub1 = document.querySelector('.timer-row .row-sub').textContent;
  await new Promise((x) => setTimeout(x, 1300));
  const sub2 = document.querySelector('.timer-row .row-sub').textContent;
  r(
    JSON.stringify({
      lbl,
      rows: n1,
      sub1,
      sub2,
      orb: el.timerVal.textContent,
      orbHidden: el.timerOrb.classList.contains('hidden'),
      count: S.timers.length
    })
  );
});
