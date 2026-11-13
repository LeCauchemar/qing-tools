'use strict';
// 检查 account.json 的落盘形态：是否用 DPAPI 加密、有没有明文 token
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(process.env.APPDATA || '', 'DynamicIsland', 'account.json');
const exists = fs.existsSync(file);
const raw = exists ? fs.readFileSync(file, 'utf8') : '';
let parsed = null;
try {
  parsed = JSON.parse(raw);
} catch (_) {}

console.log(
  JSON.stringify(
    {
      file,
      exists,
      bytes: raw.length,
      hasDpapi: raw.includes('dpapi:'),
      plainToken: /"token"\s*:\s*"[0-9a-f]{64}"/.test(raw),
      keys: parsed ? Object.keys(parsed) : [],
      tokenEncPrefix: parsed && parsed.tokenEnc ? String(parsed.tokenEnc).slice(0, 12) : ''
    },
    null,
    2
  )
);
