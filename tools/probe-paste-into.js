(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const n of (S.data.notes || []).slice()) await api.notes.remove(n.id);
  const r0 = await api.notes.add('AAA\nBBB');
  const id = r0.note.id;
  setTab('notes'); setMode('panel', true); await wait(300);
  S.noteOpen = id; S.noteEdit = id; renderNotes(); await wait(350);
  const box = document.querySelector('.note-rich[data-id="' + id + '"]');
  box.focus();
  const t0 = box.firstChild;
  const rng = document.createRange();
  rng.setStart(t0, 3); rng.collapse(true);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(rng);
  await wait(250);
  const caret1 = JSON.stringify(S.noteCaret);
  const inp = document.querySelector('#noteInput');
  inp.focus();
  const cv = document.createElement('canvas'); cv.width = 300; cv.height = 200;
  const g = cv.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 300, 200);
  const blob = await new Promise((x) => cv.toBlob(x, 'image/png'));
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'x.png', { type: 'image/png' }));
  inp.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  await wait(1400);
  const n = (S.data.notes || [])[0] || {};
  return JSON.stringify({ caret1, notes: (S.data.notes || []).length, text: n.text });
})()
