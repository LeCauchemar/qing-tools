import fs from 'node:fs';

const p = 'src/renderer/index.html';
let s = fs.readFileSync(p, 'utf8');
const startMark = '<div class="tool-card" data-tool="todo">';
const endMark = '<div class="tool-card" data-tool="remind">';
const a = s.indexOf(startMark);
const b = s.indexOf(endMark);
if (a < 0 || b < 0 || b < a) {
  console.log('markers', a, b);
  process.exit(1);
}
const before = s.length;
s = s.slice(0, a) + s.slice(b);
fs.writeFileSync(p, s, 'utf8');
console.log('removed', b - a, 'chars;', before, '->', s.length, 'fffd:', s.includes('\uFFFD'), 'todo card left:', s.includes(startMark));
