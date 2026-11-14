import fs from 'node:fs';

const t = fs.readFileSync('site/changelog.html', 'utf8');
const ti = t.match(/<title>[\s\S]*?<\/title>/);
const de = t.match(/<meta[^>]*name="description"[^>]*>/);
const h1 = t.match(/<h1>[\s\S]*?<\/h1>/);
console.log(ti && ti[0]);
console.log(de && de[0]);
console.log(h1 && h1[0].replace(/\s+/g, ' '));
console.log('last </section> at', t.lastIndexOf('</section>'), 'len', t.length);
