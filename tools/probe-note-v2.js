(async () => {
  const c = document.createElement('canvas');
  c.width = 120;
  c.height = 80;
  const g = c.getContext('2d');
  g.fillStyle = '#3a7';
  g.fillRect(0, 0, 120, 80);
  g.fillStyle = '#fff';
  g.font = '20px sans-serif';
  g.fillText('PIC', 30, 45);
  const url = c.toDataURL('image/png');
  const sv = await api.notes.image({ dataUrl: url });
  const n = await api.notes.add('上面一段\n[[img:' + sv.file + ']]\n下面一段');
  await new Promise((r) => setTimeout(r, 300));
  setMode('panel', true);
  setTab('notes');
  await new Promise((r) => setTimeout(r, 600));
  const row = document.querySelector('.row.note[data-id="' + n.note.id + '"]');
  const imgs = row ? row.querySelectorAll('.note-img').length : -1;
  if (!row) return { imgs, error: 'row missing' };
  row.querySelector('[data-act="note-edit"]').click();
  await new Promise((r) => setTimeout(r, 350));
  const ta = document.querySelector('textarea.note-ta');
  return {
    imgs,
    thumbs: document.querySelectorAll('.note-thumb').length,
    thumbSrc: (document.querySelector('.note-thumb') || {}).src,
    value: ta && ta.value,
    focused: document.activeElement === ta,
    id: n.note.id,
    file: sv.file
  };
})()
