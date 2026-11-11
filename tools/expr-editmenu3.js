(async () => {
  const log = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const n of (S.data.notes || []).slice()) {
    if (/^MENU-T/.test(n.text || '')) await api.notes.remove(n.id);
  }
  const made = await api.notes.add('MENU-T2 正文');
  const id = made.note ? made.note.id : made.id;
  setTab('notes');
  setMode('panel', true);
  S.noteOpen = id;
  S.noteEdit = id;
  renderNotes();
  await sleep(500);
  const box = document.querySelector('.note-rich[data-id="' + id + '"]');
  box.focus();
  const r = document.createRange();
  r.selectNodeContents(box);
  r.collapse(true);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
  document.execCommand('insertText', false, 'AAA-');
  await sleep(60);
  const rect = box.getBoundingClientRect();
  box.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rect.left + 20, clientY: rect.top + 10 }));
  await sleep(100);
  log.push('open ' + !document.querySelector('#editMenu').classList.contains('hidden') + ' target ' + S.editTarget);
  await api.clips.writeText('BBB');
  document.querySelector('#editMenu [data-act="edit-paste"]').click();
  await sleep(1300);
  const cur = (S.data.notes || []).find((n) => n.id === id);
  log.push('store ' + JSON.stringify(cur.text));
  log.push('notes ' + (S.data.notes || []).length);
  log.push('menuClosed ' + document.querySelector('#editMenu').classList.contains('hidden'));
  return log;
})()
