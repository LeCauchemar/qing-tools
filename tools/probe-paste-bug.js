(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const a = await api.notes.add('AAA'); const idA = a.note.id;
  await wait(300);
  const b = await api.notes.add('BBB'); const idB = b.note.id;
  await wait(300);
  setTab('notes'); setMode('panel', true); await wait(350);
  S.noteOpen = idA; S.noteEdit = idA; renderNotes(); await wait(350);
  const box = document.querySelector('.note-rich[data-id="' + idA + '"]');
  box.focus();
  const r = document.createRange(); r.selectNodeContents(box); r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  document.execCommand('insertText', false, '-XYZ');
  // 打字后 200ms 立刻粘贴（自动保存还没到 800ms）
  await wait(200);
  const inp = document.querySelector('#noteInput'); inp.focus();
  const cv = document.createElement('canvas'); cv.width = 100; cv.height = 60;
  const g = cv.getContext('2d'); g.fillStyle = '#a33'; g.fillRect(0, 0, 100, 60);
  const blob = await new Promise((x) => cv.toBlob(x, 'image/png'));
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'p.png', { type: 'image/png' }));
  inp.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  await wait(1600);
  const now = {}; (S.data.notes || []).forEach((n) => { now[n.id] = n.text; });
  return JSON.stringify({ idA, idB, now, order: (S.data.notes || []).map((n) => n.id) });
})()
