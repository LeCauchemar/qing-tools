(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const n of (S.data.notes || []).slice()) await api.notes.remove(n.id);
  const r0 = await api.notes.add('1.这是第一行。\n2.下面插一张截图：');
  const id = (r0 && r0.note && r0.note.id) || (S.data.notes[0] || {}).id;
  setTab('notes'); setMode('panel', true);
  await wait(300);
  S.noteOpen = id; S.noteEdit = id; renderNotes();
  await wait(400);
  const box = document.querySelector('.note-rich[data-id="' + id + '"]');
  const rng = document.createRange(); rng.selectNodeContents(box); rng.collapse(false);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(rng);
  const cv = document.createElement('canvas'); cv.width = 920; cv.height = 560;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 920, 560);
  grad.addColorStop(0, '#1f6feb'); grad.addColorStop(1, '#7b3fe4');
  g.fillStyle = grad; g.fillRect(0, 0, 920, 560);
  g.fillStyle = 'rgba(255,255,255,.94)'; g.font = 'bold 60px system-ui'; g.fillText('截图示例 920x560', 80, 300);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'shot.png', { type: 'image/png' }));
  box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  await wait(1000);
  document.execCommand('insertText', false, '3.图片后面还能继续编辑。');
  await wait(1200);
  const t = noteRichRead(box);
  await api.notes.update(id, t);
  await wait(200);
  return JSON.stringify({ id, text: t, imgs: document.querySelectorAll('.note-pic').length, notes: (S.data.notes || []).length });
})()
