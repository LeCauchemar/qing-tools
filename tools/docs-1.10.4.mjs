import fs from 'node:fs';

let r = fs.readFileSync('README.md', 'utf8');
r = r.split('QingTools-1.10.2-setup.exe').join('QingTools-1.10.4-setup.exe');
r = r.split('从 1.0 到 1.10.2').join('从 1.0 到 1.10.4');
fs.writeFileSync('README.md', r);

const marker = '## 几个绕不过去的工程决定';
let c = fs.readFileSync('CHANGELOG.md', 'utf8');
const section = `## 1.10.4 · 编辑框右键菜单，粘贴回到当前那条（11-10）
- 备忘录编辑框里右键会弹「剪切 / 复制 / 粘贴 / 粘贴图片 / 全选」，图片插在光标处；以前 Electron 里右键什么都不弹。
- 重绘前先把编辑框里的内容落盘（\`flushLiveNote()\`），刚打的字不会被旧数据盖掉。
- 编辑中的那一条钉在原来的位置（\`noteSort()\`），不因为自动保存刷新了时间就跳走 —— 之前看起来就像图片"跑到下面那条"。
- 粘贴优先级：编辑框里 → 展开的那条 → 上次光标那条 → 都没有才新建。
- 桌面便签里的图改成完整比例显示（\`object-fit: contain\`，上限 240px）。

`;
if (!c.includes('## 1.10.4')) {
  c = c.replace(marker, section + marker);
  fs.writeFileSync('CHANGELOG.md', c);
  console.log('changelog updated');
}
