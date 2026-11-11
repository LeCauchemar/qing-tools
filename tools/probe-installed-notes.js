(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const r = await api.notes.add('安装版测试：下面插一张图');
  const id = r.note.id;
  setTab('notes'); setMode('panel', true); await wait(300);
  S.noteOpen = id; S.noteEdit = id; renderNotes(); await wait(400);
  const box = document.querySelector('.note-rich[data-id="' + id + '"]');
  const rng = document.createRange(); rng.selectNodeContents(box); rng.collapse(false);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(rng);
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360;
  const g = cv.getContext('2d'); g.fillStyle = '#33aa77'; g.fillRect(0, 0, 640, 360);
  g.fillStyle = '#fff'; g.font = 'bold 44px system-ui'; g.fillText('安装版截图', 80, 200);
  const blob = await new Promise((x) => cv.toBlob(x, 'image/png'));
  const dt = new DataTransfer(); dt.items.add(new File([blob], 's.png', { type: 'image/png' }));
  box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  await wait(900);
  document.execCommand('insertText', false, '图片后面继续写');
  await wait(900);
  const t = noteRichRead(box);
  await api.notes.update(id, t);
  S.noteEdit = null; S.noteOpen = null; document.activeElement.blur(); renderNotes(); await wait(300);
  return JSON.stringify({ v: S.data.meta.version, text: t, pic: document.querySelectorAll('.row.note .note-img').length });
})()
