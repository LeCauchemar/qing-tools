// 1.16.0：版本号 + 官网开发记录 + CHANGELOG + README
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

// 1) package.json
const pkgPath = 'package.json';
const pkg = JSON.parse(read(pkgPath));
pkg.version = '1.16.0';
write(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// 2) site/changelog.html
let cl = read('site/changelog.html');
cl = cl.replace('<b>64</b>', '<b>65</b>');
cl = cl.replace('（1.0 → 1.15.2）', '（1.0 → 1.16.0）');
cl = cl.replace(/从 1\.0 到 1\.15\.2/g, '从 1.0 到 1.16.0');
cl = cl.replace(/v1\.15\.2/g, 'v1.16.0');
cl = cl.replace(/QingTools-1\.15\.2-setup\.exe/g, 'QingTools-1.16.0-setup.exe');
cl = cl.replace(/QingTools-1\.15\.2-portable\.exe/g, 'QingTools-1.16.0-portable.exe');
cl = cl.replace('十天，六十多个版本', '十天，六十多个版本');

const entry = `
    <article class="cl-item v1">
      <div class="cl-side"><b>1.16.0</b><span>11-14</span></div>
      <div class="cl-body">
        <h3>Qing 事项跟着账号走：换台电脑，写完的东西还在</h3>
        <ul>
          <li>每一项都带版本号落到云端：本机改完 0.5 秒后自动上传，另一台电脑 20 秒内自己长出来，包括待办的勾。</li>
          <li>删除也会同步：一边删掉，另一边下次同步就消失，不会「复活」。</li>
          <li>两台电脑同时改同一条：以最后写入的为准，被覆盖的那版留成一条「另一台设备改过的版本」，界面上有淡黄色标签，不丢字。</li>
          <li>笔记里的图片会自动传到又拍云，正文里只留一个云端 key，另一台电脑直接看到图，不再传 base64。</li>
          <li>设置页账号区多了一行「事项同步」：几条事项、上次同步是几秒前、有没有待上传的，都能看见，也可以手动「立即同步」。</li>
        </ul>
      </div>
    </article>
`;
const at = cl.lastIndexOf('</article>');
if (at < 0) throw new Error('no article');
cl = cl.slice(0, at + '</article>'.length) + '\n' + entry + cl.slice(at + '</article>'.length);
write('site/changelog.html', cl);

// 3) CHANGELOG.md
let md = read('CHANGELOG.md');
md = md.replace(/从 1\.0 到 1\.15\.2，十天里发了 64 个可安装版本/, '从 1.0 到 1.16.0，十天里发了 65 个可安装版本');
if (md.includes('## 1.16.0')) {
  // 已有就跳过
} else {
  const block = `## 1.16.0 · Qing 事项跟着账号走（11-14）

- \`/api/items\` 增量接口：首次 \`?since=0\` 给全量快照，之后按 \`changes\` 的 \`seq\` 拉增量，墓碑（已删除）也在增量里。
- 客户端主进程新增 \`src/main/sync.js\`：本地改完 0.5 秒防抖推送，20 秒轮询拉取；推送时把 \`[[img:<file>]]\` 上传到又拍云并改写成 \`[[img:cloud:<key>]]\`。
- 冲突策略 LWW + 副本：客户端带上 \`baseUpdatedAt\`，服务器发现对方在这之后改过且内容不同，就把被覆盖的那版另存一条 \`origin.conflict\`，界面上标「另一台设备改过的版本」。
- 删除是软删除：\`deleted_at\` + \`changes\` 记一条 \`delete\`，另一台设备拉到墓碑后本地也删掉。
- 设置页新增「事项同步」一行（条数 / 上次同步 / 待上传 / 立即同步）。

`;
  md = md.replace('## 几个绕不过去的工程决定', block + '## 几个绕不过去的工程决定');
}
write('CHANGELOG.md', md);

// 4) README：版本串 + 功能表新增一行
let rd = read('README.md');
rd = rd.replace(/1\.15\.2/g, '1.16.0');
if (!rd.includes('| **多端同步** |')) {
  rd = rd.replace(
    /\| \*\*账号\*\* \|/,
    '| **多端同步** | 登录同一个账号的第二台电脑，20 秒内自动长出你在别的机器上写的事项；改完 0.5 秒上传，删除也会同步，冲突留副本 |\n| **账号** |'
  );
}
write('README.md', rd);

// 5) site/index.html 版本串
let idx = read('site/index.html');
idx = idx.replace(/1\.15\.2/g, '1.16.0');
write('site/index.html', idx);

const out = {
  pkg: JSON.parse(read('package.json')).version,
  cl: cl.includes('1.16.0'),
  md: md.includes('1.16.0'),
  readme: rd.includes('多端同步'),
  fffd: [cl, md, rd, idx].some((s) => s.includes('\uFFFD'))
};
console.log(JSON.stringify(out));
