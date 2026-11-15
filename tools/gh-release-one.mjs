import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const REPO = 'LeCauchemar/qing-tools';
const [tag, name, bodyFile] = process.argv.slice(2);
if (!tag || !name || !bodyFile) {
  console.error('usage: node tools/gh-release-one.mjs <tag> <name> <body.md>');
  process.exit(2);
}

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
const headers = {
  authorization: 'Bearer ' + TOKEN,
  accept: 'application/vnd.github+json',
  'content-type': 'application/json',
  'user-agent': 'qing-tools-release'
};

const exists = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${tag}`, { headers });
if (exists.status === 200) {
  console.log(tag, 'already exists ->', (await exists.json()).html_url);
  process.exit(0);
}

const res = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    tag_name: tag,
    name,
    body: fs.readFileSync(bodyFile, 'utf8'),
    draft: false,
    prerelease: false
  })
});
const data = await res.json();
console.log(tag, res.status, data.html_url || JSON.stringify(data).slice(0, 300));
