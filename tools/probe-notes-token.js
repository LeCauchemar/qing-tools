(async () => {
  const c = document.createElement('canvas');
  c.width = 120;
  c.height = 70;
  const g = c.getContext('2d');
  g.fillStyle = '#7b8cff';
  g.fillRect(0, 0, 120, 70);
  g.fillStyle = '#fff';
  g.font = '16px sans-serif';
  g.fillText('TEST', 36, 42);
  const url = c.toDataURL('image/png');
  const saved = await api.notes.image({ dataUrl: url });
  const r = await api.notes.add('上面一段\n[[img:' + saved.file + ']]\n下面一段');
  renderNotes();
  const id = r.note && r.note.id;
  const row = id ? document.querySelector('.row.note[data-id="' + id + '"]') : null;
  return JSON.stringify({
    saved: saved.ok,
    file: saved.file,
    id,
    imgs: row ? row.querySelectorAll('.note-img').length : -1,
    texts: row ? Array.from(row.querySelectorAll('.row-text')).map((n) => n.textContent) : []
  });
})()
