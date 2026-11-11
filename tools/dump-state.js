const fs = require('fs');
const path = require('path');
const p = path.join(process.env.APPDATA, 'DynamicIsland', 'state.json');
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
console.log(JSON.stringify({
  notes: d.notes.map(n => ({ id: n.id, t: n.text.slice(0, 40), pin: !!n.pinned, w: n.w, h: n.h, fs: n.fontSize })),
  clips: d.clips.length,
  clipPins: d.clips.filter(c => c.pinned).length,
  files: d.files.length,
  settings: d.settings
}, null, 1));
