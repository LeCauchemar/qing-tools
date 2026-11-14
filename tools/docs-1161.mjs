import fs from 'node:fs';

const files = ['README.md', 'site/index.html', 'site/iphone.html', 'site/android.html', 'CHANGELOG.md'];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, 'utf8');
  const before = s;
  s = s.replace(/1\.16\.0/g, '1.16.1');
  if (s !== before) fs.writeFileSync(f, s);
  console.log(f, before !== s ? 'updated' : 'no-change', s.length);
}

// CHANGELOG.md：统计 + 小节
let md = fs.readFileSync('CHANGELOG.md', 'utf8');
if (!md.includes('## 1.16.1')) {
  md = md.replace(/从 1\.0 到 1\.16\.1，[^\n]*\n/, (m) => m.replace(/发了 \d+ 个可安装版本/, '发了 66 个可安装版本'));
  const sec = [
    '## 1.16.1 · 小纸条改两栏（11-14）',
    '',
    '- 面板宽度 576 → 640px，小纸条页改成左右两栏：左栏 150px 放频道和好友，右栏放消息。',
    '- 频道整行显示、名字过长自动省略；复制匹配码与退出按钮只在悬停/选中时出现。',
    '- 好友从横排小胶囊改成竖排整行；「咻记录」入口移到好友标题右侧。',
    '- 左栏顶部「+」可直接新建频道（已有两个会提示先退出一个）。',
    ''
  ].join('\n');
  md = md.replace('## 几个绕不过去的工程决定', sec + '\n## 几个绕不过去的工程决定');
  fs.writeFileSync('CHANGELOG.md', md);
  console.log('changelog md ok', md.length);
} else {
  console.log('changelog md already');
}
