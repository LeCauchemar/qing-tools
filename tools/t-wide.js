const { SearchService } = require('../src/main/search.js');
(async () => {
  for (const q of ['package', 'package.json']) {
    const svc = new SearchService({ getSettings: () => ({ searchEngine: 'local', searchRoots: [{ dir: 'D:\\', maxDepth: 3 }] }) });
    const r = await svc.search(q, { limit: 5 });
    console.log(q, JSON.stringify({ ok: r.ok, took: r.took, total: r.total, n: (r.results||[]).length, first: (r.results||[]).map(x=>x.path).slice(0,2) }));
  }
})();
