(async () => {
  const inp = document.querySelector('#noteInput');
  if (!inp) return JSON.stringify({ err: 'no input' });
  inp.value = 'T1 第一行\nT2 第二行';
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.focus();
  inp.setSelectionRange(inp.value.length, inp.value.length);
  const c = document.createElement('canvas');
  c.width = 300; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#22b8dd'; g.fillRect(0, 0, 300, 160);
  g.fillStyle = '#fff'; g.font = '28px sans-serif'; g.fillText('IMG', 20, 60);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const dt = new DataTransfer();
  dt.items.add(new File([blob], 'paste.png', { type: 'image/png' }));
  const before = (S.data.notes || []).length;
  inp.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 1500));
  const notes = (S.data.notes || []).map((n) => ({ id: n.id, text: (n.text || '').slice(0, 80) }));
  return JSON.stringify({
    before,
    after: notes.length,
    inputLeft: inp.value,
    notes,
    pics: document.querySelectorAll('.note-pic').length,
  });
})()
