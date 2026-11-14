import fs from 'node:fs';

const p = 'site/changelog.html';
let s = fs.readFileSync(p, 'utf8');

const re = /<article class="cl-item[^"]*">[\s\S]*?<\/article>/g;
const blocks = s.match(re) || [];
if (!blocks.length) {
  console.error('no blocks');
  process.exit(2);
}
const key = (b) => {
  const m = b.match(/cl-side"><b>([^<]+)<\/b>/);
  if (!m) return 0;
  const v = m[1].match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!v) return 0;
  return Number(v[1]) * 1e6 + Number(v[2]) * 1e3 + Number(v[3] || 0);
};
const label = (b) => (b.match(/cl-side"><b>([^<]+)<\/b>/) || [, ''])[1];
const seen = new Map();
for (const b of blocks) {
  const k = label(b);
  const prev = seen.get(k);
  if (!prev || b.length > prev.length) seen.set(k, b);
}
const items = [...seen.values()].sort((a, b) => key(a) - key(b));
if (items.some((b) => label(b) === '1.16.1')) {
  console.log('already');
  process.exit(0);
}

const entry = `  <article class="cl-item v1">
      <div class="cl-side"><b>1.16.1</b><span>11-14</span></div>
      <div class="cl-body">
        <h3>小纸条改成两栏：左边频道和好友，右边才是消息</h3>
        <ul>
          <li>面板加宽到 640px，左边固定 150px 一栏：上面是频道（最多两个，一直置顶），下面是好友，一个一个竖着排。</li>
          <li>频道条改成整行按钮，名字长了自己省略；鼠标移上去才露出「复制匹配码」和「退出」两个小图标，不再挤在一起。</li>
          <li>右边的消息区有独立宽度，气泡和输入框不会再压到好友/频道上；拉高窗口时只有消息区变长，左栏不动。</li>
          <li>左栏顶部有个「+」，直接新建频道（已有两个时会提示先退一个）。</li>
        </ul>
      </div>
    </article>`;

const first = s.indexOf(blocks[0]);
const lastBlock = blocks[blocks.length - 1];
const last = s.indexOf(lastBlock) + lastBlock.length;
s = s.slice(0, first) + items.join('\n') + '\n' + entry + s.slice(last);

s = s.replace(/<b>65<\/b><span>个可安装版本（1\.0 → 1\.16\.0）<\/span>/, '<b>66</b><span>个可安装版本（1.0 → 1.16.1）</span>');
s = s.replace(/Qing Tools 从 1\.0 到 1\.16\.0<\/title>/, 'Qing Tools 从 1.0 到 1.16.1</title>');
s = s.replace(/十天六十一个版本/, '十天六十六个版本');
s = s.replace(/QingTools-1\.16\.0-setup\.exe/g, 'QingTools-1.16.1-setup.exe');
s = s.replace(/QingTools-1\.16\.0-portable\.exe/g, 'QingTools-1.16.1-portable.exe');
s = s.replace(/<span class="dim">v1\.16\.0<\/span>/, '<span class="dim">v1.16.1</span>');

fs.writeFileSync(p, s);
console.log('entries', items.length + 1, 'len', s.length, 'has1161', s.includes('1.16.1'), 'b66', s.includes('<b>66</b>'));
