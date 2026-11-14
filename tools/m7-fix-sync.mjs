import fs from 'node:fs';
const p = 'src/main/sync.js';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(
  "const { account } = require('./account');",
  "const accountMod = require('./account');\nconst acc = () => accountMod.account();"
);
s = s.replace(/account\.(signedIn|items|itemCreate|itemPatch|itemDelete|itemImage)/g, 'acc().$1');
fs.writeFileSync(p, s);
console.log('ok', (s.match(/acc\(\)\./g) || []).length);
