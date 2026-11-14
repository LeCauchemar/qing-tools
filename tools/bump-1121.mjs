import fs from 'node:fs';

const OLD = '1.12.0';
const VER = '1.12.1';

const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = VER;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// changelog
const clPath = 'site/changelog.html';
let cl = fs.readFileSync(clPath, 'utf8');
cl = cl.replace('<b>58</b>', '<b>59</b>');
cl = cl.replace('（1.0 → ' + OLD + '）', '（1.0 → ' + VER + '）');
cl = cl.replace(/v1\.12\.0/g, 'v' + VER);
cl = cl.replace(/QingTools-1\.12\.0-setup\.exe/g, 'QingTools-' + VER + '-setup.exe');
cl = cl.replace(/QingTools-1\.12\.0-portable\.exe/g, 'QingTools-' + VER + '-portable.exe');

const entry = [
  '    <article class="cl-item v1">',
  '      <div class="cl-side"><b>' + VER + '</b><i>11-14</i></div>',
  '      <div class="cl-body">',
  '        <h3>归属之后，笔记里的图片也跟着搬过去</h3>',
  '        <ul>',
  '          <li>之前把本机数据归到账号时只搬了文字，图片还留在本机目录里，结果账号分区里全是裂图（列表里只剩一个「图片」占位）。</li>',
  '          <li>现在归属时会扫描每条笔记里的 <code>[[img:文件]]</code> 引用，把缺的图片从本机 <code>note-images</code> 复制到账号目录，重名跳过、路径做白名单校验，不会覆盖已有文件。</li>',
  '          <li>已经在 1.12.0 归属过的机器，这次启动后打开那条笔记就能看到图（旧的裂图会重新解析到复制过来的文件）。</li>',
  '        </ul>',
  '      </div>',
  '    </article>',
  ''
].join('\n');
const last = cl.lastIndexOf('</section>');
cl = cl.slice(0, last) + entry + cl.slice(last);
fs.writeFileSync(clPath, cl, 'utf8');

// site index + README + CHANGELOG.md
let idx = fs.readFileSync('site/index.html', 'utf8');
idx = idx.split(OLD).join(VER);
fs.writeFileSync('site/index.html', idx, 'utf8');

let rd = fs.readFileSync('README.md', 'utf8');
rd = rd.split(OLD).join(VER);
fs.writeFileSync('README.md', rd, 'utf8');

let md = fs.readFileSync('CHANGELOG.md', 'utf8');
md = md.replace(/58 个可安装版本/g, '59 个可安装版本');
md = md.replace(/到 1\.12\.0/g, '到 ' + VER);
const mdEntry = [
  '',
  '## ' + VER + ' · 归属时连图片一起搬（11-14）',
  '',
  '- `account:claim` 现在会扫描笔记正文里的 `[[img:<file>]]`，把缺的图片从本机 `note-images` 复制到账号分区（文件名白名单、已存在则跳过）。',
  '- 1.12.0 里归属后出现的裂图，这次启动就会恢复显示。',
  '',
  '---',
  ''
].join('\n');
const anchor = '## 几个绕不过去的工程决定';
const pos = md.indexOf(anchor);
md = pos >= 0 ? md.slice(0, pos) + mdEntry + md.slice(pos) : md + mdEntry;
fs.writeFileSync('CHANGELOG.md', md, 'utf8');

// AGENTS + HANDOFF
const agPath = 'D:/deepseek harness daily/AGENTS.md';
let ag = fs.readFileSync(agPath, 'utf8');
if (!ag.includes('1.12.1 归属搬图片')) {
  ag += [
    '',
    '## 1.12.1 归属搬图片',
    '- `account:claim` 除了并 notes/todos/reminders/anniversaries，还要扫 `[[img:<file>]]` 与 `note.image`，把 `DATA_DIR\\note-images` 里缺的文件复制到 `noteImagesDir()`（账号分区），否则账号里图片全是裂图（1.12.0 的 bug）。',
    '- 复制前做 `/^[A-Za-z0-9._-]+$/` 白名单校验，目标已存在就跳过；`copied.images` 记数量。',
    '- 已经归属过的机器：直接把 `%APPDATA%\\DynamicIsland\\note-images\\*` 复制到 `accounts\\<uid>\\note-images\\` 即可修复历史数据。',
    '',
    '---',
    ''
  ].join('\n');
  fs.writeFileSync(agPath, ag, 'utf8');
}
let ho = fs.readFileSync('HANDOFF.md', 'utf8');
if (!ho.includes('1.12.1 · DeepSeekRuntime')) {
  ho = [
    '## 2026-11-14 12:05 · 1.12.1 · DeepSeekRuntime',
    '',
    '- 改了什么：归属账号时连笔记图片一起搬（扫 `[[img:]]`，从本机 note-images 复制到账号目录）。',
    '- 为什么：1.12.0 只搬文字，账号分区里所有带图的笔记都变成裂图。',
    '- 怎么验证：装机版里打开「Qing 事项」，那条带图的笔记能显示缩略图、点开能看大图。',
    '- 下一步 / 已知问题：M5 仍只做归属 + 换机 join，消息级 user_id（多端按人归并、已读按用户）还没做。',
    '',
    '---',
    ''
  ].join('\n') + ho;
  fs.writeFileSync('HANDOFF.md', ho, 'utf8');
}
console.log('bumped', VER, 'cl', cl.length, 'md', md.length);
