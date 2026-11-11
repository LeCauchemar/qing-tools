(async () => {
  const out = {};
  const tabs = ['mail', 'notes', 'clipboard', 'files', 'chat', 'tools', 'settings'];
  for (const t of tabs) {
    setTab(t);
    await new Promise((r) => setTimeout(r, 160));
    const pane = document.querySelector('[data-pane="' + t + '"]');
    out[t] = {
      nodes: pane ? pane.querySelectorAll('*').length : -1,
      rows: pane ? pane.querySelectorAll('.row').length : -1,
      text: pane ? (pane.innerText || '').slice(0, 40).replace(/\s+/g, ' ') : ''
    };
  }
  setTab('notes');
  out.heapMB = Math.round((performance.memory ? performance.memory.usedJSHeapSize : 0) / 1048576);
  out.totalNodes = document.querySelectorAll('*').length;
  return JSON.stringify(out);
})();
