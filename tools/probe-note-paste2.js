(async () => {
  setMode('panel', true);
  setTab('notes');
  await new Promise((r) => setTimeout(r, 500));
  let ta = document.querySelector('textarea.note-ta');
  if (!ta) {
    const btn = document.querySelector('.row.note [data-act="note-edit"]');
    if (!btn) return { error: 'no note' };
    btn.click();
    await new Promise((r) => setTimeout(r, 350));
    ta = document.querySelector('textarea.note-ta');
  }
  if (!ta) return { error: 'not editing' };
  ta.focus();
  const anchor = ta.value.indexOf('下面一段');
  const pos = anchor > 0 ? anchor : ta.value.length;
  ta.setSelectionRange(pos, pos);
  const c = document.createElement('canvas');
  c.width = 40;
  c.height = 30;
  c.getContext('2d').fillRect(0, 0, 40, 30);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const file = new File([blob], 'shot.png', { type: 'image/png' });
  const dt = new DataTransfer();
  dt.items.add(file);
  ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 800));
  const ta2 = document.querySelector('textarea.note-ta');
  const val = ta2 ? ta2.value : '';
  const caret = ta2 ? ta2.selectionStart : -1;
  return {
    value: val,
    caret,
    focused: document.activeElement === ta2,
    thumbs: document.querySelectorAll('.note-thumb').length,
    toast: document.querySelector('#toast').classList.contains('show'),
    toastText: document.querySelector('#toast').textContent,
    lineAfterImg: val.slice(caret, caret + 4)
  };
})()
