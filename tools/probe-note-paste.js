(async () => {
  const note = (S.data.notes || [])[0];
  if (!note) return JSON.stringify({ err: 'no note' });
  await api.clips.writeText('粘贴测试 ABC', true);
  await new Promise((r) => setTimeout(r, 300));
  const got = await api.clips.readNow();
  openNoteMenu(320, 320, note.id);
  await new Promise((r) => setTimeout(r, 120));
  const btn = document.querySelector('#noteMenu [data-act="note-menu-paste"]');
  if (!btn) return JSON.stringify({ err: 'no button', got });
  btn.click();
  await new Promise((r) => setTimeout(r, 700));
  const after = (S.data.notes || []).find((n) => n.id === note.id);
  return JSON.stringify({ kind: got && got.kind, readText: got && got.text, tail: after ? after.text.slice(-24) : '' });
})()
