// 一次性：把版本号推到 1.10.8，并给开发记录 / CHANGELOG / README / AGENTS 补条目
import fs from 'node:fs';

const V = '1.10.8';
const PREV = '1.10.7';
const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');

// package.json
const pkg = JSON.parse(read('package.json'));
pkg.version = V;
write('package.json', JSON.stringify(pkg, null, 2) + '\n');

// 站点其余页面 + README：纯版本串替换（这些文件里没有历史条目）
for (const f of ['site/index.html', 'site/iphone.html', 'site/android.html', 'README.md']) {
  const s = read(f);
  write(f, s.split(PREV).join(V));
}

// changelog.html：只替换页脚/下载链接/统计，历史条目里的 1.10.7 不动
let cl = read('site/changelog.html');
cl = cl
  .replace(`<title>开发记录 · Qing Tools 从 1.0 到 ${PREV}</title>`, `<title>开发记录 · Qing Tools 从 1.0 到 ${V}</title>`)
  .replace('七天五十二个版本', '七天五十三个版本')
  .replace(`到 ${PREV}，它替你收邮件`, `到 ${V}，它替你收邮件`)
  .replace('<b>52</b><span>个可安装版本（1.0 → ' + PREV + '）</span>', '<b>53</b><span>个可安装版本（1.0 → ' + V + '）</span>')
  .split(`v${PREV}`)
  .join(`v${V}`)
  .split(`QingTools-${PREV}-`)
  .join(`QingTools-${V}-`);

const entry = `
    <article class="cl-item v4">
      <div class="cl-side"><b>${V}</b><i>11-11</i></div>
      <div class="cl-body">
        <h3>安装包改走又拍云 CDN，连不通再回自己服务器</h3>
        <ul class="cl-list">
          <li><b>小工具里点「检查更新」下载的是 CDN。</b>100 MB 的安装包不再从 chat.ccyyqq.com 走，改成先拉 qing.ccyyqq.com（又拍云）；服务器只负责发几百字节的 latest.json，带宽留给别的事。</li>
          <li><b>连不通会自动换地址。</b>每个来源下完都算一遍 SHA-256 和 latest.json 对一遍，不一致或者网络错误就换下一个：CDN → 清单来源的服务器 → 服务器固定地址，三条都不行才报失败。</li>
          <li><b>官网的按钮也一样。</b>页面加载时先探一下 CDN 的 latest.json，探不通就把三个下载按钮和「备用下载」对调，下面那行字会标成「已自动切到本站镜像」。</li>
          <li><b>清单仍然是服务器优先。</b>又拍云会把 latest.json 缓存好几天，所以「有没有新版本」还是问自己服务器，发布即生效。</li>
        </ul>
      </div>
    </article>

  </section>`;

const tail = '\n  </section>';
if (!cl.includes(tail)) throw new Error('changelog 插入点没找到');
cl = cl.replace(tail, entry);
write('site/changelog.html', cl);

// CHANGELOG.md
let md = read('CHANGELOG.md');
md = md
  .replace(`从 1.0 到 ${PREV}，七天里发了 52 个可安装版本`, `从 1.0 到 ${V}，七天里发了 53 个可安装版本`)
  .replace(`到 ${PREV} 它已经是一个能收邮件`, `到 ${V} 它已经是一个能收邮件`);
const mdSection = `## ${V} · 安装包走 CDN，连不通再回服务器（11-11）

- **下载顺序反过来了**：以前清单和安装包都优先问自己的服务器；现在清单仍走服务器（CDN 会缓存好几天），安装包优先走又拍云 \`qing.ccyyqq.com\`，100 MB 不占服务器带宽。
- **三条地址依次回退**：CDN → 清单来源的服务器 → \`chat.ccyyqq.com/island/update\`；每下完一个都算 SHA-256 与 \`latest.json\` 比对，不一致就当这条失败，删掉重试下一条。
- **官网同步**：\`site.js\` 加载时探一次 CDN 的 \`latest.json\`（4 秒超时），探不通就把 \`.js-dl\` / \`.js-dl-portable\` 换成 \`/download/\` 镜像，并把提示行标成「已自动切到本站镜像」。
- **日志**：主进程下载成功会写 \`[update] downloaded <file> from <url>\`，失败写 \`[update] source failed <url> <reason>\`，排查时先看 \`%APPDATA%\\DynamicIsland\\logs\\main.log\`。

## 几个绕不过去的工程决定`;
md = md.replace('## 几个绕不过去的工程决定', mdSection);
write('CHANGELOG.md', md);

// AGENTS.md：追加一条
const agentsPath = 'D:/deepseek harness daily/AGENTS.md';
let ag = fs.readFileSync(agentsPath, 'utf8');
ag += `

## ${V} 下载走 CDN（客户端 + 官网）
- 安装包下载顺序：\`CDN_UPDATE\`（https://qing.ccyyqq.com/island/update）→ 清单来源 \`base\` → \`SERVER_UPDATE\`（https://chat.ccyyqq.com/island/update）。\`downloadSources(file, base)\` 生成候选，\`fetchToFile()\` 每次下完都校验 sha256，失败就换下一个；别把顺序改回「服务器优先」，那是 100 MB 走自己带宽。
- **更新清单仍旧服务器优先**（\`UPDATE_BASES()\` 不动）：又拍云对 \`latest.json\` 会缓存好几天，改顺序会让「检查更新」看到旧版本。
- 官网：\`site.js\` 的 \`applyDownloadLinks(file)\` 会先 \`cdnReachable()\`（fetch CDN \`latest.json\`，4 秒超时），探不通就把 \`.js-dl\`/\`.js-dl-portable\`/\`.js-mirror\` 对调，并给 \`#dlMirror\` 加 \`.fallback\`、改 \`#dlMirrorText\` 文案。改完记得把 \`site.js?v=\` / \`site.css?v=\` 各加一。
`;
fs.writeFileSync(agentsPath, ag, 'utf8');

console.log('ok', V, 'changelog', cl.length, 'md', md.length);
