import fs from "node:fs";

const V = "1.15.1";
const pkgPath = "package.json";
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.version = V;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// ---------- changelog.html ----------
const clPath = "site/changelog.html";
let cl = fs.readFileSync(clPath, "utf8");
cl = cl.replace(/<b>62<\/b>/, "<b>63</b>");
cl = cl.replace(/（1\.0 → 1\.15\.0）/g, "（1.0 → " + V + "）");
cl = cl.replace(/v1\.15\.0/g, "v" + V);
cl = cl.replace(/QingTools-1\.15\.0-setup\.exe/g, "QingTools-" + V + "-setup.exe");
cl = cl.replace(/QingTools-1\.15\.0-portable\.exe/g, "QingTools-" + V + "-portable.exe");
cl = cl.replace(/到 1\.15\.0，它替你/g, "到 " + V + "，它替你");

const entry = `    <article class="cl-item v5">
      <div class="cl-side"><b>${V}</b><span>11-14</span></div>
      <div class="cl-main">
        <h2>Base64 能读图片了，几 MB 的数据也不会再把界面拖成 PPT</h2>
        <ul>
          <li>开发小工具里「Base64」多了图片这条路：可以直接选一张图片转成 Base64，也可以把一大串 Base64 解回图片，解出来就在面板里预览。</li>
          <li>解码前先做体检：去掉换行空格、兼容 URL 安全的 <code>-</code>/<code>_</code>、剥掉 <code>data:image/png;base64,</code> 前缀，长度不对或者混进了别的字符会直接告诉你第几个字符有问题，而不是丢一句 atob 报错。</li>
          <li>最常见的「从聊天里复制了一半」会被认出来：开头像 PNG、但只有 20 字节时，会说「数据不完整，多半是从中间截断了」。</li>
          <li>不再把整段结果塞进文本框：超过 2 万字符只显示前 2 万（复制拿到的仍是完整内容），单次解码上限 8 MB，图片超过 6 MB 走文件选择而不是剪贴板。</li>
          <li>顺手的：解出来的图片可以「另存为」存到下载文件夹；直接把图片 Ctrl+V 粘进输入框，会自动走图片转 Base64。</li>
        </ul>
      </div>
    </article>

`;
const lastArticle = cl.lastIndexOf("</article>");
if (lastArticle < 0) throw new Error("no article");
cl = cl.slice(0, lastArticle + "</article>".length + 1) + entry + cl.slice(lastArticle + "</article>".length + 1);
fs.writeFileSync(clPath, cl);

// ---------- index.html ----------
for (const f of ["site/index.html", "site/iphone.html", "site/android.html", "README.md"]) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, "utf8");
  s = s.split("1.15.0").join(V);
  fs.writeFileSync(f, s);
}

// ---------- README 功能表 ----------
let rd = fs.readFileSync("README.md", "utf8");
rd = rd.replace(
  /(\| \*\*小工具\*\* \|[^\n]*\n)/,
  "$1| **Base64** | 文字和图片两个方向都行：选图片转成 Base64，或把一大串 Base64 解回图片并在面板里预览、另存；会检查长度与非法字符，超大内容自动截断显示，不再把界面拖慢。 |\n"
);
fs.writeFileSync("README.md", rd);

// ---------- CHANGELOG.md ----------
let ch = fs.readFileSync("CHANGELOG.md", "utf8");
ch = ch.replace(/从 1\.0 到 1\.15\.0，十天里发了 62 个可安装版本/, "从 1.0 到 " + V + "，十天里发了 63 个可安装版本");
const idx = ch.indexOf("## 几个绕不过去的工程决定");
const section = `## ${V} · Base64 读图片，大串不再卡（11-14）

- Base64 面板支持图片双向：选图片转 Base64、Base64 解回图片并预览，可另存为。
- 解码前先清理与校验：去空白、兼容 URL 安全字符、剥 data URL 前缀，长度 4n+1 或含非法字符时给出第几个字符。
- 截断检测：开头像某类图片但解出来不够长时，直接说明「数据不完整，多半被截断了」。
- 结果超过 2 万字符只显示前 2 万（复制仍是完整内容），单次解码上限 8 MB，图片超过 6 MB 走文件选择。
- 图片可直接 Ctrl+V 粘进输入框，自动走「图片 → Base64」。

`;
ch = ch.slice(0, idx) + section + ch.slice(idx);
fs.writeFileSync("CHANGELOG.md", ch);

console.log("bumped", V, "cl", cl.length, "changelog.md", ch.length, "readme", rd.length);
console.log("fffd", cl.includes("\uFFFD"), ch.includes("\uFFFD"), rd.includes("\uFFFD"));