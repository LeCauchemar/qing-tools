import fs from 'node:fs';
const ROOT = 'D:/deepseek harness daily/dynamic-island';
const p = (r) => ROOT + '/' + r;
const read = (r) => fs.readFileSync(p(r), 'utf8');
const write = (r, s) => fs.writeFileSync(p(r), s, 'utf8');
const VER = '1.16.3';
const PREV = '1.16.2';

/* package.json */
write('package.json', read('package.json').replace(/("version"\s*:\s*")[^"]+(")/, `$1${VER}$2`));

/* changelog */
let cl = read('site/changelog.html');
cl = cl.replace(`（1.0 → ${PREV}）`, `（1.0 → ${VER}）`);
cl = cl.replace('<b>67</b>', '<b>68</b>');
cl = cl.replaceAll(`QingTools-${PREV}-setup.exe`, `QingTools-${VER}-setup.exe`);
cl = cl.replaceAll(`QingTools-${PREV}-portable.exe`, `QingTools-${VER}-portable.exe`);
cl = cl.replace(`v${PREV}`, `v${VER}`);
cl = cl.replace(`到 ${PREV}，它替你收邮件`, `到 ${VER}，它替你收邮件`);
cl = cl.replace(/十天六十[一二三四五六七八九]?个版本/g, '十天六十八个版本');
cl = cl.replace(/<title>([^<]*)<\/title>/, (m, t) => `<title>${t.replace(/1\.\d+\.\d+/g, VER)}</title>`);

const item = `    <article class="cl-item v1">
      <div class="cl-side"><b>${VER}</b><span>11-14</span></div>
      <div class="cl-body">
        <h3>重启之后，钉在桌面上的便条还在</h3>
        <ul>
          <li>应用启动时会先按「本机分区」贴一遍便条，等登录态恢复、切到账号分区之后没人再贴一次，于是钉在桌面上的便条在重启后就凭空消失了。</li>
          <li>现在分区一切换就会重新对齐桌面便条：该贴的贴出来、该收的收回去。</li>
          <li>顺带确认：便条里的云端图片在重启后也能正常显示（1.16.2 修的就是这条）。</li>
        </ul>
      </div>
    </article>
`;
const anchor = cl.lastIndexOf('</section>');
cl = cl.slice(0, anchor) + item + '    ' + cl.slice(anchor);
write('site/changelog.html', cl);

/* CHANGELOG.md */
let md = read('CHANGELOG.md');
md = md.replace(/从 1\.0 到 [\d.]+，十天里发了 \d+ 个可安装版本/, `从 1.0 到 ${VER}，十天里发了 68 个可安装版本`);
const mdItem = `## ${VER} · 重启后便条还贴在桌上（11-14）

- 启动时便条是按「本机分区」贴的，登录态恢复后 store 切到账号分区，但没有再同步一次，钉住的便条就消失了。
- 现在 \`useProfile()\` 切完分区会调用 \`syncStickies()\`，桌面便条跟着分区走。

`;
const mdAnchor = md.indexOf('## 几个绕不过去的工程决定');
md = mdAnchor > 0 ? md.slice(0, mdAnchor) + mdItem + md.slice(mdAnchor) : md + '\n' + mdItem;
write('CHANGELOG.md', md);

for (const rel of ['README.md', 'site/index.html', 'site/iphone.html', 'site/android.html']) {
  write(rel, read(rel).replaceAll(PREV, VER));
}

console.log('bumped', VER, 'cl', cl.length, 'md', md.length);
