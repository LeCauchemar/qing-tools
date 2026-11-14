const urls = [
  'https://qingtools.ccyyqq.com/changelog.html',
  'https://qingtools.ccyyqq.com/'
];
for (const u of urls) {
  const r = await fetch(u, { cache: 'no-store' });
  const t = await r.text();
  console.log(u, r.status, t.length);
  console.log('  has 1.12.0:', t.includes('1.12.0'), '| 58:', t.includes('<b>58</b>'), '| Qing 事项:', t.includes('Qing 事项') || t.includes('Qing事项'), '| v1.12.0 footer:', t.includes('v1.12.0'));
}
