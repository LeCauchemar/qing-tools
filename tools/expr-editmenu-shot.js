(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const n of (S.data.notes || []).slice()) {
    if (/MENU-T2/.test(n.text || '')) await api.notes.remove(n.id);
  }
  const made = await api.notes.add('右键菜单演示：这一段文字下面可以插图片\n第二行');
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
  r.collapse(false);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
  const rect = box.getBoundingClientRect();
  box.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rect.left + 120, clientY: rect.top + 60 }));
  await sleep(300);
  return { id: id, menu: !document.querySelector('#editMenu').classList.contains('hidden') };
})()
