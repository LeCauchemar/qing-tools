const fs = require('fs');
const path = require('path');
const p = path.join(process.env.APPDATA, 'DynamicIsland', 'state.json');
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
const drop = new Set(['note_mw3fx9r7_2', 'note_mw3bendl_2']); // 我造的演示便笺
const before = d.notes.length;
d.notes = d.notes.filter(n => !drop.has(n.id));
d.settings.accent = 'violet';
d.settings.islandX = 0;
d.settings.dndUntil = 0;
fs.writeFileSync(p, JSON.stringify(d, null, 2));
console.log('notes', before, '->', d.notes.length, 'accent', d.settings.accent);
