(async () => {
  const out = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  S.grace = Date.now() + 600000;

  document.querySelector('.quick[data-open="files"]').click();
  await wait(700);
  out.push('quick→' + S.mode + '/' + S.tab);

  document.querySelector('.tab[data-tab="clipboard"]').click();
  await wait(600);
  out.push('tab→' + S.mode + '/' + S.tab);

  const rows = document.querySelectorAll('#clipList .row');
  out.push('clipRows=' + rows.length);

  const noteTab = document.querySelector('.tab[data-tab="notes"]');
  noteTab.click();
  await wait(500);
  document.querySelector('#noteInput').value = '来自 CDP 的自动化便笺';
  document.querySelector('#noteSave').click();
  await wait(500);
  out.push('notes=' + S.data.notes.length);

  const del = document.querySelector('#noteList .row [data-act="note-del"]');
  if (del) {
    del.click();
    await wait(500);
    out.push('afterDel=' + S.data.notes.length);
  }
  return out.join(' | ');
})();
