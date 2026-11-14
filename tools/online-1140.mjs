const r = await fetch('https://qingtools.ccyyqq.com/changelog.html');
const t = await r.text();
const checks = {
  status: r.status,
  len: t.length,
  v1140: t.includes('1.14.0'),
  b61: t.includes('<b>61</b>'),
  footer: t.includes('v1.14.0'),
  title: t.includes('从 1.0 到 1.14.0'),
  entry: t.includes('频道跟着账号走')
};
console.log('changelog', JSON.stringify(checks));

const home = await (await fetch('https://qingtools.ccyyqq.com/')).text();
console.log('home', JSON.stringify({ v: home.includes('1.14.0'), setup: home.includes('QingTools-1.14.0-setup.exe') }));

const man = await (await fetch('https://chat.ccyyqq.com/island/update/latest.json')).json();
console.log('manifest', JSON.stringify(man).slice(0, 220));

const health = await (await fetch('https://chat.ccyyqq.com/island/api/health')).json();
console.log('health', JSON.stringify(health));

const dir = await (await fetch('https://chat.ccyyqq.com/island/api/hooks')).text().catch(() => '');
console.log('rooms-note', dir.length);
