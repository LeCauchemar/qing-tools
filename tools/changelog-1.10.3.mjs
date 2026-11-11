// 一次性脚本：把 1.10.3 的条目写进开发记录，并同步版本号/统计/下载直链
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const clPath = path.join(root, 'site', 'changelog.html');
const idxPath = path.join(root, 'site', 'index.html');

let cl = fs.readFileSync(clPath, 'utf8');
const before = cl;

cl = cl.replace('<title>开发记录 · Qing Tools 从 1.0 到 1.10.2</title>', '<title>开发记录 · Qing Tools 从 1.0 到 1.10.3</title>');
cl = cl.replace('五天四十七个版本的开发过程', '六天四十八个版本的开发过程');
cl = cl.replace('Qing Tools 五天四十七个版本', 'Qing Tools 六天四十八个版本');
cl = cl.replace('五天，四十来个版本，', '六天，四十来个版本，');
cl = cl.replace('到 1.10.2，它替你收邮件', '到 1.10.3，它替你收邮件');
cl = cl.replace('<b>47</b><span>个可安装版本（1.0 → 1.10.2）</span>', '<b>48</b><span>个可安装版本（1.0 → 1.10.3）</span>');
cl = cl.replace('<b>5</b><span>天（11-05 → 11-09）</span>', '<b>6</b><span>天（11-05 → 11-10）</span>');
cl = cl.replace(/QingTools-1\.10\.2-(setup|portable)\.exe/g, 'QingTools-1.10.3-$1.exe');
cl = cl.replace(/v1\.10\.2/g, 'v1.10.3');

const entry = `
    <article class="cl-item v5">
      <div class="cl-side"><b>1.10.3</b><i>11-10</i></div>
      <div class="cl-body">
        <h3>备忘录变成真正的富文本：图片长在文字中间</h3>
        <ul class="cl-list">
          <li><b>粘贴不再另起一条。</b>根因是编辑态用的是 <code>&lt;textarea&gt;</code>，塞不进图片，旧代码只能把图片存成一条新备忘录。改成 <code>contenteditable</code> 富文本后，图片留在光标处，条目还是那一条。</li>
          <li><b>插入要等异步。</b>存图要几百毫秒，等回来时选区早没了 —— 先在光标处插一个零宽占位文本节点，图存好再把它换成图片，光标落在图下一行，可以接着写。</li>
          <li><b>编辑时不重建 DOM。</b>重渲染会把光标顶掉，所以正在编辑的富文本框直接跳过重建；停止输入 800ms 自动存一次，<code>Ctrl+Enter</code> 立即保存退出。</li>
          <li><b>图片尺寸。</b>行是纵向 flex，不写 <code>align-self: flex-start</code>，小图会被拉成整行宽；现在小图保持原尺寸，大截图按 132px 高缩略，点开仍是全屏遮罩。</li>
          <li><b>桌面便签同样显示。</b>钉到桌面的便利贴里，图片按原文位置显示（上限 240px 高、完整不裁切），在便签里继续打字、插图都会原样存回去。</li>
        </ul>
      </div>
    </article>
`;

const marker = '\n  </section>\n\n  <footer class="foot">';
if (!cl.includes(marker)) throw new Error('changelog marker not found');
cl = cl.replace(marker, entry + marker);

fs.writeFileSync(clPath, cl, 'utf8');

let idx = fs.readFileSync(idxPath, 'utf8');
const ibefore = idx;
idx = idx.replace(/QingTools-1\.10\.2-(setup|portable)\.exe/g, 'QingTools-1.10.3-$1.exe');
idx = idx.replace(/v1\.10\.2/g, 'v1.10.3');
fs.writeFileSync(idxPath, idx, 'utf8');

console.log(JSON.stringify({
  clChanged: cl !== before,
  entry: cl.includes('1.10.3'),
  stats: /<b>48<\/b>/.test(cl) && /11-10/.test(cl),
  idxChanged: idx !== ibefore,
  idxOldLeft: (idx.match(/1\.10\.2/g) || []).length,
  clOldLeft: (cl.match(/1\.10\.2/g) || []).length,
}, null, 2));
