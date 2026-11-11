(async () => {
  const probe = await api.files.probe();
  const r = await api.files.search('package', { mode: 'name', limit: 5 });
  return JSON.stringify({ probe: probe, ok: r.ok, engine: r.engine, took: r.took, n: (r.results || []).length, first: (r.results || [])[0] && r.results[0].path });
})()
