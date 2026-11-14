import fs from 'node:fs';
const p = 'package.json';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
j.version = '1.16.1';
fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
console.log('pkg', j.version);
