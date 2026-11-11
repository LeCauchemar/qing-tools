import fs from 'node:fs';
const t = fs.readFileSync('site/changelog.html', 'utf8');
const idxs = [];
let p = -1;
while ((p = t.indexOf('<article class="cl-item', p + 1)) !== -1) idxs.push(p);
console.log('items', idxs.length);
for (const i of idxs.slice(-3)) {
  console.log('---------');
  console.log(t.slice(i, i + 900));
}
