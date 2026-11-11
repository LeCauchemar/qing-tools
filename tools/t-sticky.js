new Promise(async (r) => {
  S.grace = Date.now() + 900000;
  setMode('idle');
  const st = await api.getState();
  let note = st.notes[0];
  if (!note) {
    note = (await api.notes.add('桌面便条测试：把鼠标移到右上角按钮上，按钮应该一直在。')).note;
  }
  if (!note.pinned) await api.notes.togglePin(note.id);
  await new Promise((x) => setTimeout(x, 900));
  r(JSON.stringify({ id: note.id, pinned: true, text: note.text.slice(0, 20) }));
});
