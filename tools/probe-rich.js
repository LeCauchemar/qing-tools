(async () => {
  const out = {};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const r = await api.notes.add('第一行文字\n第二行');
  const id = (r && r.id) || (S.data.notes[0] && S.data.notes[0].id);
  out.id = id;
  setTab('notes');
  setMode('panel', true);
  S.noteOpen = id;
  S.noteEdit = id;
  renderNotes();
  await wait(320);
  const box = document.querySelector('.note-rich[data-id="' + id + '"]');
  out.rich = !!box;
  out.text0 = (S.data.notes.find((n) => n.id === id) || {}).text;

  // 光标放到第一行中间
  const tn = box.firstChild;
  const rng = document.createRange();
  rng.setStart(tn, Math.min(3, tn.nodeValue.length));
  rng.collapse(true);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(rng);

  // 造一张图并派发 paste
  const cv = document.createElement('canvas');
  cv.width = 40;
  cv.height = 30;
  cv.getContext('2d').fillStyle = '#cc3333';
  cv.getContext('2d').fillRect(0, 0, 40, 30);
  const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
  const file = new File([blob], 'shot.png', { type: 'image/png' });
  const dt = new DataTransfer();
  dt.items.add(file);
  box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  await wait(1000);
  out.text1 = (S.data.notes.find((n) => n.id === id) || {}).text;
  out.imgs = box.querySelectorAll('img.note-pic').length;
  out.notesNow = (S.data.notes || []).length;

  // 图片后面继续打字
  document.execCommand('insertText', false, 'ABC');
  await wait(1100);
  out.text2 = (S.data.notes.find((n) => n.id === id) || {}).text;

  // 回车换行再打字
  box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  document.execCommand('insertText', false, '下一行');
  await wait(1100);
  out.text3 = (S.data.notes.find((n) => n.id === id) || {}).text;
  out.html = box.innerHTML.slice(0, 360);
  out.notesAfter = (S.data.notes || []).length;
  return JSON.stringify(out);
})()
