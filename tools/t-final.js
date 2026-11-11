new Promise(async (r) => {
  S.grace = Date.now() + 900000;
  setPinned(true);
  setMode('panel');
  setTab('tools');
  await new Promise((x) => setTimeout(x, 600));
  el.timerH.value = '0';
  el.timerM.value = '12';
  el.timerS.value = '30';
  startTimer(timerFromInputs());
  await new Promise((x) => setTimeout(x, 500));
  const id = S.data.notes[0].id;
  const res = await api.notes.togglePin(id);
  await new Promise((x) => setTimeout(x, 900));
  r(JSON.stringify({ pinned: res && res.pinned, note: id, timers: S.timers.length, sub: el.timerSub.textContent }));
});
