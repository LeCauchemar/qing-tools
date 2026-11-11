import fs from 'node:fs';

const OLD = '1.10.9';
const NEW = '1.10.10';

// 只替换「下载文件名 / 页脚版本 / 区间右端」，不动历史条目里的 1.10.9
function bumpVersions(p) {
  let s = fs.readFileSync(p, 'utf8');
  s = s.split('QingTools-' + OLD + '-setup.exe').join('QingTools-' + NEW + '-setup.exe');
  s = s.split('QingTools-' + OLD + '-portable.exe').join('QingTools-' + NEW + '-portable.exe');
  s = s.split('v' + OLD).join('v' + NEW);
  s = s.split('1.0 → ' + OLD).join('1.0 → ' + NEW);
  s = s.split('到 ' + OLD).join('到 ' + NEW);
  fs.writeFileSync(p, s);
  console.log(p, 'bumped');
}

// 1) changelog.html：hero 数字 + 新条目
{
  const p = 'site/changelog.html';
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(/<b>54<\/b>/, '<b>55</b>');
  s = s.replace(/七天五十四个版本/g, '七天五十五个版本');
  const entry = [
    '',
    '    <div class="cl-item v4">',
    '      <div class="cl-side"><b>1.10.10</b><span>11-11</span></div>',
    '      <div class="cl-main">',
    '        <h3>两套主题的次要文字统一了，提醒的彩虹边真的会跑圈</h3>',
    '        <ul>',
    '          <li>倒计时 / 提醒卡片里的灰色小字（「每月 20 号」「还有 9 天」这类）原来在深色下偏白、浅色下偏灰，两边可读性都不稳。现在全部按主题文字色混出来，两套主题各自等比缩放。</li>',
    '          <li>提醒到点的彩虹边，之前其实是「一条斜渐变」被窗口圆角裁掉一半，看着像贴在顶边的光条；改成 conic 渐变绕边旋转，现在是真的沿着一圈跑马灯。</li>',
    '          <li>顺手加了一条 reduced-motion 保护：系统开了「减少动画」时不转，只留静态彩边。</li>',
    '        </ul>',
    '      </div>',
    '    </div>',
    ''
  ].join('\n');
  s = s.replace('\n  </section>\n\n  <footer class="foot">', entry + '\n  </section>\n\n  <footer class="foot">');
  fs.writeFileSync(p, s);
  console.log('changelog.html entry ok');
  bumpVersions(p);
}

// 2) CHANGELOG.md
{
  const p = 'CHANGELOG.md';
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(/54 个可安装版本/, '55 个可安装版本');
  s = s.split('到 ' + OLD).join('到 ' + NEW);
  const md = [
    '',
    '## 1.10.10 · 主题对比度 + 真·跑马灯（11-11）',
    '',
    '- 次要文字（`.row-sub` / `.row .time` / `.tc-sum` / `.cd-label` / `.cd-badge`）不再用主题里写死的 `--muted`/`--dim`，统一改成 `color-mix(in srgb, var(--ink) N%, transparent)`：浅色变浅、深色变深，两套主题的对比度自动对齐。',
    '- `rim-rainbow` 之前是 `inset:-3px` 的斜渐变，被 `.island` 的 `overflow:hidden` 裁掉一半，只剩顶边一条；改成 `inset:0` + `conic-gradient(from var(--rim-a))` + `@property --rim-a` 旋转，才是真正沿边缘跑圈。',
    '- 加了 `prefers-reduced-motion` 保护。',
    '',
    ''
  ].join('\n');
  s = s.replace('## 几个绕不过去的工程决定', md + '## 几个绕不过去的工程决定');
  fs.writeFileSync(p, s);
  console.log('CHANGELOG.md ok');
}

// 3) 其它页面版本串
for (const p of ['site/index.html', 'site/iphone.html', 'site/android.html', 'README.md']) bumpVersions(p);

// 4) package.json
{
  const p = 'package.json';
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.version = NEW;
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.log('package.json', j.version);
}
