(async () => {
  const log = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const note = (S.data.notes || []).find((n) => /MENU-T2/.test(n.text || ''));
  const id = note.id;
  S.noteOpen = id;
  S.noteEdit = id;
  renderNotes();
  await sleep(400);
  const box = document.querySelector('.note-rich[data-id="' + id + '"]');
  box.focus();
  const r = document.createRange();
  r.selectNodeContents(box);
  r.collapse(true);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
  const rect = box.getBoundingClientRect();
  box.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rect.left + 20, clientY: rect.top + 10 }));
  await sleep(100);
  const pasteImg = document.querySelector('#editMenu [data-act="edit-paste-img"]');
  log.push('hasPasteImg ' + !!pasteImg);
  pasteImg.click();
  await sleep(1500);
  const cur = (S.data.notes || []).find((n) => n.id === id);
  log.push('store ' + JSON.stringify(cur.text));
  log.push('pics ' + document.querySelectorAll('.note-rich[data-id="' + id + '"] .note-pic').length);
  log.push('notes ' + (S.data.notes || []).length);
  return log;
})()

