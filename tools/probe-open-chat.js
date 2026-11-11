(async () => {
  setMode('panel'); setTab('chat'); await new Promise((r) => setTimeout(r, 800));
  return 'ready';
})()
