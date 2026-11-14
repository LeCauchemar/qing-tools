(async () => {
  const out = {};
  const t = await api.account.token();
  const extId = 'itm_ext_' + Date.now().toString(36);
  const r = await fetch('https://chat.ccyyqq.com/island/api/items', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t },
    body: JSON.stringify({ id: extId, kind: 'todo', text: '外部设备写的待办（M7）' })
  });
  const j = await r.json();
  out.ext = { ok: j.ok, id: extId };
  const p = await api.sync.pull();
  out.pull = p;
  await new Promise((r2) => setTimeout(r2, 600));
  out.notes = (S.data.notes || []).map((x) => ({ id: x.id, t: x.text, remote: !!x.remote, kind: x.kind }));
  // 再删掉它，验证墓碑能同步回来
  const d = await fetch('https://chat.ccyyqq.com/island/api/items/' + extId, {
    method: 'DELETE',
    headers: { authorization: 'Bearer ' + t }
  });
  out.del = (await d.json()).ok;
  const p2 = await api.sync.pull();
  out.pull2 = p2;
  await new Promise((r3) => setTimeout(r3, 600));
  out.after = (S.data.notes || []).map((x) => x.id);
  return out;
})()
