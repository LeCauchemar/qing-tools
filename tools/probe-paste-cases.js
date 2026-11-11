(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const mk = async (w, h, c) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, w, h); const b = await new Promise((x) => cv.toBlob(x, 'image/png')); return new File([b], 'p.png', { type: 'image/png' }); };
  const pasteAt = async (node, file) => { const dt = new DataTransfer(); dt.items.add(file); node.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); await wait(1000); };
  const out = {};
  // 场景 A：不展开也不编辑任何备忘录 → 新建一条
  for (const n of (S.data.notes || []).slice()) await api.notes.remove(n.id);
  setTab('notes'); setMode('panel', true); await wait(250);
  S.noteOpen = null; S.noteEdit = null; S.noteCaret = null; renderNotes(); await wait(200);
  await pasteAt(document.querySelector('#noteInput'), await mk(80, 60, '#08f'));
  out.fresh = { notes: (S.data.notes || []).length, text: (S.data.notes[0] || {}).text };
  // 场景 B：有一条处于展开（非编辑）状态 → 插到这条末尾，不新建
  const id = S.data.notes[0].id;
  S.noteOpen = id; S.noteEdit = null; S.noteCaret = null; document.activeElement && document.activeElement.blur(); renderNotes(); await wait(250);
  await pasteAt(document.querySelector('#noteInput'), await mk(80, 60, '#0a8'));
  out.openView = { notes: (S.data.notes || []).length, text: (S.data.notes[0] || {}).text, open: S.noteOpen };
  return JSON.stringify(out);
})()
