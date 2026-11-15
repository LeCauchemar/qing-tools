import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO = 'LeCauchemar/qing-tools';
const TAG = process.argv[2] || 'v1.16.3';
const FILES = process.argv.slice(3);

function token() {
  const out = execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8'
  });
  const m = out.match(/^password=(.+)$/m);
  if (!m) throw new Error('no github token');
  return m[1].trim();
}

const TOKEN = token();
const auth = { authorization: 'Bearer ' + TOKEN, accept: 'application/vnd.github+json', 'user-agent': 'qing-tools-release' };

const rel = await (await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${TAG}`, { headers: auth })).json();
if (!rel.id) throw new Error('release not found: ' + JSON.stringify(rel).slice(0, 200));

const have = new Set((rel.assets || []).map((a) => a.name));

for (const file of FILES) {
  const name = path.basename(file);
  if (have.has(name)) {
    console.log(name, 'already attached');
    continue;
  }
  if (!fs.existsSync(file)) {
    console.log(name, 'missing locally');
    continue;
  }
  const size = fs.statSync(file).size;
  console.log(`uploading ${name} (${(size / 1048576).toFixed(1)} MB) ...`);
  const t0 = Date.now();
  const r = spawnSync(
    'curl.exe',
    [
      '-sS',
      '-X', 'POST',
      '-H', 'Authorization: Bearer ' + TOKEN,
      '-H', 'Content-Type: application/octet-stream',
      '-H', 'User-Agent: qing-tools-release',
      '--data-binary', '@' + file,
      `https://uploads.github.com/repos/${REPO}/releases/${rel.id}/assets?name=${encodeURIComponent(name)}`
    ],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
  );
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  let ok = false;
  try {
    const j = JSON.parse(r.stdout || '{}');
    ok = j.state === 'uploaded' || j.state === 'starter';
    console.log(name, r.status, ok ? j.state : JSON.stringify(j).slice(0, 200), secs + 's');
  } catch {
    console.log(name, r.status, (r.stdout || '').slice(0, 200), (r.stderr || '').slice(0, 200), secs + 's');
  }
}
