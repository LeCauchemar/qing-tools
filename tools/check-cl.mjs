import fs from 'node:fs';
const s = fs.readFileSync('site/changelog.html', 'utf8');
const items = (s.match(/class="cl-item/g) || []).length;
const sections = (s.match(/<section/g) || []).length;
console.log('len', s.length, 'cl-item', items, 'section', sections, 'fffd', s.includes('\uFFFD'));
console.log('has1140', s.includes('1.14.0'), 'b61', s.includes('<b>61</b>'), 'v1140', s.includes('v1.14.0'));
const i = s.indexOf('1.14.0');
console.log(JSON.stringify(s.slice(Math.max(0, i - 140), i + 160)));
