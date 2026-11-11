(async () => {
  const id = (S.data.notes || [])[0] && S.data.notes[0].id;
  S.noteOpen = id; S.noteEdit = id;
  if (typeof renderNotes === 'function') renderNotes();
  await new Promise((r) => setTimeout(r, 500));
  const inp = document.querySelector('#noteInput');
  inp.value = '';
  inp.focus();
  const box = document.querySelector('.note-rich[data-id="' + id + '"]');
  if (box) { box.focus({ preventScroll: true }); }
  const before = (S.data.notes || []).length;
  const c = document.createElement('canvas');
  c.width = 200; c.height = 120;
  const g = c.getContext('2d'); g.fillStyle = '#e95'; g.fillRect(0, 0, 200, 120);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const dt = new DataTransfer();
  dt.items.add(new File([blob], 'p2.png', { type: 'image/png' }));
  inp.focus();
  inp.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 1400));
  return JSON.stringify({
    editingId: id,
    before,
    after: (S.data.notes || []).length,
    notes: (S.data.notes || []).map((n) => ({ id: n.id, text: (n.text || '').slice(0, 70) })),
  });
})()
