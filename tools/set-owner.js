// 把本机身份写进 state.json（用 node，绝不走 PowerShell 文本往返）
const fs = require('fs');
const path = require('path');
const p = path.join(process.env.APPDATA, 'DynamicIsland', 'state.json');
const s = JSON.parse(fs.readFileSync(p, 'utf8'));
s.settings = s.settings || {};
s.settings.smsOwnerToken = process.argv[2] || s.settings.smsOwnerToken || '';
s.settings.smsOwnerName = process.argv[3] || s.settings.smsOwnerName || '我的电脑';
fs.writeFileSync(p, JSON.stringify(s, null, 2), 'utf8');
console.log(JSON.stringify({
  owner: s.settings.smsOwnerToken,
  name: s.settings.smsOwnerName,
  master: (s.settings.smsReadToken || '').slice(0, 6) + '…',
  devices: (s.settings.smsDevices || []).map((d) => d.name)
}));
