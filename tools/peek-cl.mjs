import fs from 'node:fs';
const s = fs.readFileSync('site/changelog.html', 'utf8');
const i = s.indexOf('</section>');
console.log('index of </section>:', i);
console.log(s.slice(i - 1600, i + 40));
