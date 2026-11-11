// 把 Everything 的 HTTP 服务器打开（只改需要的键，其它原样保留）
const fs = require('node:fs');
const path = require('node:path');

const ini = path.join(process.env.APPDATA, 'Everything', 'Everything.ini');
if (!fs.existsSync(ini)) {
  console.log(JSON.stringify({ ok: false, message: 'Everything.ini 不存在' }));
  process.exit(0);
}
const want = {
  http_server_enabled: '1',
  http_server_port: '8010',
  http_server_bindings: '127.0.0.1',
  http_server_allow_file_download: '0',
  etp_server_enabled: '1',
  etp_server_port: '8010',
  etp_server_bindings: '127.0.0.1',
  run_as_admin: '0'
};
const raw = fs.readFileSync(ini, 'utf8');
const lines = raw.split(/\r?\n/);
const seen = new Set();
const out = lines.map((line) => {
  const m = /^([A-Za-z0-9_]+)=(.*)$/.exec(line);
  if (m && Object.prototype.hasOwnProperty.call(want, m[1])) {
    seen.add(m[1]);
    return `${m[1]}=${want[m[1]]}`;
  }
  return line;
});
for (const [k, v] of Object.entries(want)) {
  if (!seen.has(k)) out.push(`${k}=${v}`);
}
fs.writeFileSync(ini + '.bak-qingtools', raw, 'utf8');
fs.writeFileSync(ini, out.join('\r\n'), 'utf8');
console.log(JSON.stringify({ ok: true, changed: [...seen], ini }));
