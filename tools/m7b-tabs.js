(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  for (const tab of ['mail', 'notes', 'clipboard', 'files', 'tools', 'settings']) {
    setTab(tab);
    setMode('panel', true);
    S.pointerIn = true;
    await wait(420);
    const pane = document.querySelector('[data-pane="' + tab + '"]');
    const island = document.querySelector('#island');
    out[tab] = {
      islandW: Math.round(island.getBoundingClientRect().width),
      scrollW: pane ? pane.scrollWidth : 0,
      clientW: pane ? pane.clientWidth : 0,
      overflows: pane ? pane.scrollWidth > pane.clientWidth + 1 : null
    };
  }
  setTab('chat');
  setMode('panel', true);
  await wait(300);
  return out;
})()
