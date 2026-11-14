import fs from 'node:fs';

const ROOT = 'D:/deepseek harness daily/dynamic-island';
const p = (rel) => ROOT + '/' + rel;
const read = (rel) => fs.readFileSync(p(rel), 'utf8');
const write = (rel, s) => fs.writeFileSync(p(rel), s, 'utf8');

const VER = '1.16.2';
const PREV = '1.16.1';

/* 1) package.json */
const pkg = read('package.json').replace(/("version"\s*:\s*")[^"]+(")/, `$1${VER}$2`);
write('package.json', pkg);

/* 2) site/changelog.html */
let cl = read('site/changelog.html');
cl = cl.replace(`（1.0 → ${PREV}）`, `（1.0 → ${VER}）`);
cl = cl.replace(/(\d+) 个可安装版本（1\.0 → /, (m) => m);
cl = cl.replace(/<b>66<\/b>/, '<b>67</b>');
cl = cl.replaceAll(`QingTools-${PREV}-setup.exe`, `QingTools-${VER}-setup.exe`);
cl = cl.replaceAll(`QingTools-${PREV}-portable.exe`, `QingTools-${VER}-portable.exe`);
cl = cl.replaceAll(`v${PREV}`, `v${VER}`);
cl = cl.replace(/十天六十[一二三四五六七八九]?个版本/g, '十天六十七个版本');
cl = cl.replace(/<title>([^<]*?)<\/title>/, (m, t) => `<title>${t.replace(/1\.\d+\.\d+/g, VER)}</title>`);
cl = cl.replace(/(name="description"\s+content="[^"]*)/, (m) => m);

const item = `
      <article class="cl-item v7">
        <div class="cl-side"><b>${VER}</b><span>11-14</span></div>
        <div class="cl-body">
          <h3>钉到桌面的便条，图片终于看得见了</h3>
          <ul>
            <li>事项同步之后，图片在正文里变成了 <code>cloud:</code> 开头的云端标记；便条窗口没认这个前缀，一直按本地文件去取，所以只剩一张破图。</li>
            <li>现在便条按前缀分流：云端标记直接走又拍云 CDN，本地文件还是走 <code>islandclip://</code>，两者都能显示。</li>
            <li>便条窗口的 CSP 放行了 CDN 域名，图片不会再被安全策略拦掉。</li>
            <li>万一真的取不到，也会画一块安静的虚线占位，不再露出破图图标和巨大的「图片」两个字。</li>
          </ul>
        </div>
      </article>
`;
const anchor = cl.lastIndexOf('</section>');
if (anchor < 0) throw new Error('no </section>');
cl = cl.slice(0, anchor) + item + '    ' + cl.slice(anchor);
write('site/changelog.html', cl);

/* 3) CHANGELOG.md */
let md = read('CHANGELOG.md');
md = md.replace(/从 1\.0 到 [\d.]+，\S*?里发了 \d+ 个可安装版本/, '从 1.0 到 ' + VER + '，十天里发了 67 个可安装版本');
const mdItem = `## ${VER} · 便条里的云端图片（11-14）

- 事项同步把图片改写成 \`cloud:<key>\` 之后，桌面便条仍按本地文件去取，结果是一张破图。
- 便条现在按前缀分流：\`cloud:\` 走又拍云 CDN，其余走 \`islandclip://\`；CSP 也放行了 CDN 域名。
- 取不到时画一条虚线占位，不再露出破图图标和 alt 文字。

`;
const mdAnchor = md.indexOf('## 几个绕不过去的工程决定');
md = mdAnchor > 0 ? md.slice(0, mdAnchor) + mdItem + md.slice(mdAnchor) : md + '\n' + mdItem;
write('CHANGELOG.md', md);

/* 4) README / 其它页面版本串 */
for (const rel of ['README.md', 'site/index.html', 'site/iphone.html', 'site/android.html']) {
  write(rel, read(rel).replaceAll(PREV, VER));
}

console.log('bumped', VER, 'cl', cl.length, 'md', md.length);
