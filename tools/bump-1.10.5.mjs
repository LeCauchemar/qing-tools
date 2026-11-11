import fs from 'node:fs';

const f = 'site/changelog.html';
let s = fs.readFileSync(f, 'utf8');

const entry = `
    <article class="cl-item v5">
      <div class="cl-side"><b>1.10.5</b><i>11-10</i></div>
      <div class="cl-body">
        <h3>新建框里写的字和刚贴的图，合成同一条</h3>
        <ul class="cl-list">
          <li><b>先打字再贴图，不会再被拆成两条。</b>以前在顶部新建框里写了一半、再按 <code>Ctrl+V</code>，图被单独存成一条，字还留在框里，一保存又多一条。现在合成同一条：图接在文字下面一行，条目直接进入编辑态。</li>
          <li><b>结论按「这次在哪个框里按的」来判。</b>新建框里有字就以新建框为准；新建框是空的，才退回正在编辑 / 展开的那条 —— 两条反馈看起来矛盾，其实是同一个判断没做对。</li>
          <li><b>右键「粘贴图片」同样生效。</b>以前菜单一关就把粘贴目标清掉了，判断永远失效；现在先记下目标再关菜单，图和字照样合成一条。</li>
          <li><b>图片一律缩略图。</b>正文里按行内缩略显示，点开是整屏遮罩看原图；钉到桌面的便签里按完整比例显示，不裁切。</li>
        </ul>
      </div>
    </article>
`;

const anchor = '\n  </section>\n\n  <footer class="foot">';
if (!s.includes(anchor)) throw new Error('anchor not found');
s = s.replace(anchor, entry + anchor);

s = s.replace('<b>49</b><span>个可安装版本（1.0 → 1.10.4）</span>', '<b>50</b><span>个可安装版本（1.0 → 1.10.5）</span>');
s = s.replace('QingTools-1.10.4-setup.exe', 'QingTools-1.10.5-setup.exe');
s = s.replace('QingTools-1.10.4-portable.exe', 'QingTools-1.10.5-portable.exe');
s = s.replace('<span class="dim">v1.10.4</span>', '<span class="dim">v1.10.5</span>');
s = s.replace('从 1.0 到 1.10.4', '从 1.0 到 1.10.5');
s = s.replace('六天四十九个版本', '六天五十个版本');

fs.writeFileSync(f, s);
console.log('changelog ok', s.length, 'has 1.10.5 entry:', s.includes('1.10.5'));

const g = 'site/index.html';
let t = fs.readFileSync(g, 'utf8');
const before = (t.match(/1\.10\.4/g) || []).length;
t = t.replace(/1\.10\.4/g, '1.10.5');
fs.writeFileSync(g, t);
console.log('index replaced', before, 'occurrences');
