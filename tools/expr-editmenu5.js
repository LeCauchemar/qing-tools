(async () => {
  const log = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  setTab('notes');
  setMode('panel', true);
  S.noteEdit = null;
  renderNotes();
  await sleep(300);
  const inp = document.querySelector('#noteInput');
  log.push('input ' + !!inp);
  inp.focus();
  inp.value = 'HEAD-';
  inp.selectionStart = inp.selectionEnd = 5;
  await api.clips.writeText('TAIL');
  const rect = inp.getBoundingClientRect();
  inp.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rect.left + 20, clientY: rect.top + 10 }));
  await sleep(100);
  log.push('target ' + S.editTarget);
  document.querySelector('#editMenu [data-act="edit-paste"]').click();
  await sleep(300);
  log.push('value ' + JSON.stringify(inp.value));
  log.push('notes ' + (S.data.notes || []).length);
  return log;
})()
