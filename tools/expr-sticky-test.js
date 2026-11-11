(async () => {
  const c = document.createElement('canvas'); c.width = 960; c.height = 560;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 960, 560); g.addColorStop(0, '#3b6ef6'); g.addColorStop(1, '#f04e8a');
  x.fillStyle = g; x.fillRect(0, 0, 960, 560);
  x.fillStyle = '#fff'; x.font = 'bold 56px sans-serif'; x.fillText('便条里的图片', 56, 130);
  x.font = '26px sans-serif'; x.fillText('点一下 → 看大图 · 滚轮缩放 · 拖动平移', 56, 196);
  const r1 = await api.notes.image({ dataUrl: c.toDataURL('image/png') });
  const r2 = await api.notes.add({ text: '便条第一行\n[[img:' + r1.file + ']]\n便条最后一行' });
  const id = (r2.note && r2.note.id) || r2.id;
  await api.notes.togglePin(id);
  return JSON.stringify({ ok: true, id, file: r1.file });
})()
