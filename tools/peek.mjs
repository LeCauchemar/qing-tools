import fs from 'node:fs';

const file = process.argv[2];
const needle = process.argv[3];
const before = Number(process.argv[4] || 200);
const len = Number(process.argv[5] || 1800);
const src = fs.readFileSync(file, 'utf8');
const at = src.indexOf(needle);
if (at < 0) {
  console.log('not found:', needle);
  process.exit(1);
}
console.log(src.slice(Math.max(0, at - before), at + len));
