(() => {
  const r = curRoom();
  const rows = (r.messages || []).slice(-6).map((m) => ({ k: m.kind, d: m.deviceName, t: String(m.text || '').slice(0, 60), u: (m.url || '').slice(0, 40) }));
  return JSON.stringify(rows);
})()
