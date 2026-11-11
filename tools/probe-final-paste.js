(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const before = (S.data.notes || []).length;
  const r0 = await api.notes.add('PROBE-T1\nPROBE-T2');
  const id = r0.note.id;
  setTab('notes'); setMode('panel', true); await wait(400);
  S.noteOpen = id; S.noteEdit = id; renderNotes(); await wait(400);
  const box = document.querySelector('.note-rich[data-id="' + id + '"]');
  box.focus();
  const t = box.firstChild; const rg = document.createRange(); rg.setStart(t, 8); rg.collapse(true);
  const s = getSelection(); s.removeAllRanges(); s.addRange(rg);
  await wait(250);
  const inp = document.querySelector('#noteInput'); inp.focus();
  const cv = document.createElement('canvas'); cv.width = 200; cv.height = 120;
  const g = cv.getContext('2d'); g.fillStyle = '#2a7'; g.fillRect(0, 0, 200, 120);
  const blob = await new Promise((x) => cv.toBlob(x, 'image/png'));
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'p.png', { type: 'image/png' }));
  inp.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  await wait(1500);
  const n = (S.data.notes || []).find((x) => x.id === id) || {};
  const out = { before, after: (S.data.notes || []).length, text: n.text };
  await api.notes.remove(id);
  await wait(400);
  out.cleaned = (S.data.notes || []).length;
  if (document.querySelector('.note-rich')) { S.noteEdit = null; S.noteOpen = null; renderNotes(); }
  setMode('idle', true);
  return JSON.stringify(out);
})()
