(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const n = (S.data.notes || []).find((x) => x.text.indexOf('带图的事项') >= 0);
  out.noteId = n ? n.id : '';
  if (!n) return out;
  await api.notes.update(n.id, n.text);
  await sleep(4000);
  const t = await api.account.token();
  const r = await fetch('https://chat.ccyyqq.com/island/api/items?since=0', { headers: { authorization: 'Bearer ' + t } });
  const j = await r.json();
  const it = (j.items || []).find((x) => x.id === n.id);
  out.server = it ? { images: it.images, urls: it.urls, text: it.text } : null;
  out.status = await api.sync.status();
  return out;
})()
