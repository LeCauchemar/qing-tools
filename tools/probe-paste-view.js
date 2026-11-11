(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const mk = async (c) => { const cv = document.createElement('canvas'); cv.width = 60; cv.height = 40; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 60, 40); const b = await new Promise((x) => cv.toBlob(x, 'image/png')); return new File([b], 'p.png', { type: 'image/png' }); };
  const pasteAt = async (node, file) => { const dt = new DataTransfer(); dt.items.add(file); node.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); await wait(1100); };
  const log = [];
  for (const n of (S.data.notes || []).slice()) await api.notes.remove(n.id);
  await wait(200);
  const r0 = await api.notes.add('hello\nworld');
  const id = r0.note.id;
  setTab('notes'); setMode('panel', true); await wait(250);
  S.noteOpen = id; S.noteEdit = null; document.activeElement && document.activeElement.blur(); renderNotes(); await wait(250);
  log.push({ step: 'before', id, open: S.noteOpen, notes: (S.data.notes || []).map((n) => n.id) });
  await pasteAt(document.querySelector('#noteInput'), await mk('#07a'));
  log.push({ step: 'after', open: S.noteOpen, edit: S.noteEdit, caret: S.noteCaret, notes: (S.data.notes || []).map((n) => ({ id: n.id, t: n.text })) });
  return JSON.stringify(log);
})()
