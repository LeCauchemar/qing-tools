import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, '..', 'CHANGELOG.md');
let s = fs.readFileSync(file, 'utf8');
const before = s;

s = s.replace('从 1.0 到 1.10.2，五天里发了 47 个可安装版本', '从 1.0 到 1.10.3，六天里发了 48 个可安装版本');
s = s.replace('到 1.10.2 它已经是一个能收邮件', '到 1.10.3 它已经是一个能收邮件');

const section = `## 1.10.3 · 备忘录变成富文本（11-10）

- **粘贴不再另起一条**：编辑态的 \`<textarea>\` 塞不进图片，旧逻辑只能把图存成新备忘；改成 \`contenteditable\` 富文本后，图片留在光标处，条目不变。
- **插入要等异步**：存图几百毫秒，等回来选区已经没了 —— 先在光标处插一个零宽占位节点，图存好再换成 \`<img>\`，光标落在图下一行。
- **编辑中不重建 DOM**：重渲染会丢光标，正在编辑的富文本框跳过重建；停止输入 800ms 自动保存，\`Ctrl+Enter\` 立即保存退出。
- **图片尺寸**：\`.row-main\` 是纵向 flex，补 \`align-self: flex-start\`，小图不再被拉满整行；大截图按 132px 高缩略，点开仍是全屏遮罩。
- **桌面便签**：便利贴里按原文位置显示图片（240px 高、contain 不裁切），在便签里继续打字/插图都会存回去。

---

`;

const marker = '## 几个绕不过去的工程决定';
if (!s.includes(marker)) throw new Error('marker missing');
s = s.replace(marker, section + marker);
fs.writeFileSync(file, s, 'utf8');
console.log(JSON.stringify({ changed: s !== before, added: s.includes('1.10.3 · 备忘录变成富文本'), stats: s.includes('六天里发了 48 个可安装版本') }, null, 2));
