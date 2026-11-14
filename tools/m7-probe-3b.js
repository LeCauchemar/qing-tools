(async () => {
  const out = { steps: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    const cv = document.createElement('canvas');
    cv.width = 96;
    cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = '#ff6f91';
    g.fillRect(0, 0, 96, 64);
    const dataUrl = cv.toDataURL('image/png');
    const img = await api.notes.image({ dataUrl });
    out.img = { ok: img.ok, file: img.file };
    out.steps.push('image');
    const n = await api.notes.add('带图的事项 [[img:' + img.file + ']] 后面还有字', 'note');
    out.noteId = n.note.id;
    out.steps.push('added');
    await sleep(4000);
    out.steps.push('waited');
    const t = await api.account.token();
    const r = await fetch('https://chat.ccyyqq.com/island/api/items?since=0', { headers: { authorization: 'Bearer ' + t } });
    const j = await r.json();
    out.server = j.ok ? (j.items || []).filter((x) => x.id === n.note.id) : j;
    out.steps.push('server');
    const local = (S.data.notes || []).find((x) => x.id === n.note.id);
    out.localText = local ? local.text : '';
    out.cloudBase = S.cloudBase;
    const it = (out.server && out.server[0]) || null;
    if (it && it.urls) {
      const key = Object.keys(it.urls)[0];
      const u = it.urls[key];
      const head = await fetch(u);
      out.cdn = { url: u, status: head.status, type: head.headers.get('content-type') };
      out.steps.push('cdn');
    }
  } catch (e) {
    out.error = String((e && e.message) || e);
  }
  return out;
})()
