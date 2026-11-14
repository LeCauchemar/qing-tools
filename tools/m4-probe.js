(async () => {
  const wait = (ms) => new Promise((s) => setTimeout(s, ms));
  const r = {};
  const tabLabel = document.querySelector('.tab[data-tab="notes"] span');
  r.tabLabel = tabLabel ? tabLabel.textContent : null;
  r.hasTypeBar = !!document.getElementById('noteType');
  r.toolCards = Array.from(document.querySelectorAll('.tool-card')).map((c) => c.dataset.tool);
  r.hasTodoCard = r.toolCards.includes('todo');

  const n1 = await api.notes.add('M4-备忘录一条', 'note');
  const n2 = await api.notes.add('M4-待办一条', 'todo');
  r.added = { note1: n1 && n1.note && n1.note.kind, note2: n2 && n2.note && n2.note.kind };
  await wait(400);

  // 待办自动钉到桌面
  const pin = await api.notes.togglePin(n2.note.id);
  r.pin = pin;
  await wait(500);

  // 打开 Qing事项页
  setTab('notes');
  setMode('panel', true);
  S.pointerIn = true;
  await wait(900);
  r.rows = document.querySelectorAll('#noteList .row.note').length;
  r.todoRows = document.querySelectorAll('#noteList .row.note.todo').length;
  r.checkBtns = document.querySelectorAll('#noteList .check-btn').length;
  const delBtns = Array.from(document.querySelectorAll('#noteList .row.note.pinned [data-act="note-del"]'));
  r.pinnedDelDisabled = delBtns.map((b) => b.disabled);
  r.statText = document.getElementById('noteStat').textContent;

  await api.notes.done(n2.note.id, true);
  await wait(500);
  r.doneRows = document.querySelectorAll('#noteList .row.note.todo.done').length;

  // 清理：只删自己建的（先解除钉）
  await api.notes.togglePin(n2.note.id);
  await wait(200);
  await api.notes.remove(n1.note.id);
  await api.notes.remove(n2.note.id);
  return JSON.stringify(r);
})()
