import fs from "node:fs";
const V = "1.15.2";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.version = V;
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");

const clPath = "site/changelog.html";
let cl = fs.readFileSync(clPath, "utf8");
cl = cl.replace(/<b>63<\/b>/, "<b>64</b>");
cl = cl.replace(/（1\.0 → 1\.15\.1）/g, "（1.0 → " + V + "）");
cl = cl.replace(/v1\.15\.1/g, "v" + V);
cl = cl.replace(/QingTools-1\.15\.1-setup\.exe/g, "QingTools-" + V + "-setup.exe");
cl = cl.replace(/QingTools-1\.15\.1-portable\.exe/g, "QingTools-" + V + "-portable.exe");
cl = cl.replace(/到 1\.15\.1，它替你/g, "到 " + V + "，它替你");

const entry = `    <article class="cl-item v5">
      <div class="cl-side"><b>${V}</b><span>11-14</span></div>
      <div class="cl-main">
        <h2>超长 Base64 不再驻在输入框里，小工具终于不卡了</h2>
        <ul>
          <li>以前把一段几 MB 的 Base64 粘进输入框后，那几百万字符一直留在 &lt;textarea&gt; 里，每次输入、滚动、切页签浏览器都要整段重排 —— 动画就变成了幻灯片。</li>
          <li>现在超过 20 万字符的内容会被直接搬进内存，输入框留空，只显示一行「已读入 2.51 MB（不放进输入框，避免卡顿）」+「复制 / 清空」两个按钮。</li>
          <li>解码 / 编码可以直接用内存里的这段数据，不用再把它塞回界面；实测 2.5 MB 的图片 Base64 解码 157 ms，输入框保持空白，连打 20 个字 0 ms。</li>
          <li>清空会同时清掉内存里的副本、预览图和结果，内存不会被一段贴过的大串长期占着。</li>
        </ul>
      </div>
    </article>

`;
const last = cl.lastIndexOf("</article>");
cl = cl.slice(0, last + "</article>".length + 1) + entry + cl.slice(last + "</article>".length + 1);
fs.writeFileSync(clPath, cl);

for (const f of ["site/index.html", "site/iphone.html", "site/android.html", "README.md"]) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, "utf8").split("1.15.1").join(V);
  fs.writeFileSync(f, s);
}

let rd = fs.readFileSync("README.md", "utf8");
rd = rd.replace(
  /\| \*\*Base64\*\* \|[^\n]*\n/,
  "| **Base64** | 文字和图片两个方向都行：选图片转成 Base64，或把一大串 Base64 解回图片并在面板里预览、另存；会检查长度与非法字符。**超过 20 万字符的内容不放进输入框**，只留一行「已读入 2.5 MB」和复制/清空，避免整段重排把界面拖卡。 |\n"
);
fs.writeFileSync("README.md", rd);

let ch = fs.readFileSync("CHANGELOG.md", "utf8");
ch = ch.replace(/从 1\.0 到 1\.15\.1，十天里发了 63 个可安装版本/, "从 1.0 到 " + V + "，十天里发了 64 个可安装版本");
const idx = ch.indexOf("## 几个绕不过去的工程决定");
const section = `## ${V} · 超长 Base64 不驻留输入框（11-14）

- 超过 20 万字符的输入不再留在 \`<textarea>\`：搬进内存 \`S.dvSrc\`，界面只显示一行说明 + 复制/清空。
- 解码/编码优先取内存里的副本（\`dvPayload()\`），不再把大串塞回 DOM。
- 实测 2.5 MB 图片 Base64：解码 157 ms、预览 1400×900 正常、输入框保持空白、连打 20 字 0 ms。
- 清空会一并释放内存副本、预览 blob 与结果。

`;
ch = ch.slice(0, idx) + section + ch.slice(idx);
fs.writeFileSync("CHANGELOG.md", ch);
console.log("bumped", V, "cl", cl.length, "ch", ch.length, "fffd", cl.includes("\uFFFD"), ch.includes("\uFFFD"));