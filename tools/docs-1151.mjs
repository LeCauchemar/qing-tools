import fs from "node:fs";
const rd = fs.readFileSync("README.md", "utf8");
console.log("b64row", rd.includes("| **Base64** |"));
const cl = fs.readFileSync("site/changelog.html", "utf8");
console.log("hero63", cl.includes("<b>63</b>"), "v1151", cl.includes("v1.15.1"), "entry", cl.includes("Base64 能读图片了"), "dl", cl.includes("QingTools-1.15.1-setup.exe"));
console.log("clItems", (cl.match(/<article class="cl-item/g) || []).length);

// AGENTS.md (workspace root)
const ap = "..\\AGENTS.md";
let a = fs.readFileSync(ap, "utf8");
if (!a.includes("## 1.15.1 · Base64 图片")) {
  a += `
## 1.15.1 · Base64 图片与大串保护（2026-11-14）

- \`DV_ACTS.b64\` 三个动作：\`b64enc\`（文字→Base64）、\`b64dec\`（Base64→文字/图片）、\`b64img\`（\`el.dvFile.click()\`）。
- \`b64Clean()\` 负责去空白/剥 data URL 前缀/URL-safe 字符/白名单校验/补 padding；长度 \`% 4 === 1\` 直接报错。
- \`sniffImage()\` 按魔数认 PNG/JPEG/GIF/WEBP/BMP/SVG；\`dvShowImage()\` 写 \`dataset.ok\`，\`dvRun\` 等 120ms 后若 \`ok === '0'\` 说明数据被截断。
- \`dvPaint()\` 只渲染前 \`B64_VIEW_MAX = 20000\` 字符，\`S.dvOut\` 保留全文；\`#dvSave\` 仅在 \`S.dvImgBlob\` 存在时显示。
- 剪贴板兜底：\`#dvIn\` 的 paste 有 \`image/*\` 直接走 \`dvRunImage\`；纯文本 >6MB 拦截、>2MB 只警告。
- **教训**：不要把几 MB 的字符串塞进 \`<textarea>\`，浏览器每帧重排会直接把动画拖成 PPT。
`;
  fs.writeFileSync(ap, a);
}
console.log("agents", a.length, a.includes("1.15.1"));

// HANDOFF.md
const hp = "HANDOFF.md";
let h = fs.readFileSync(hp, "utf8");
const head = `## 2026-11-14 15:32 · 1.15.1 · DeepSeekRuntime
- 改了什么：开发小工具的 Base64 面板支持图片双向（选图片→Base64、Base64→图片并预览/另存），解码前做清理与校验，截断的数据会被认出来；结果超过 2 万字符只显示前 2 万，单次解码上限 8 MB。
- 为什么：朋友把一段被截断的图片 Base64 粘进来，atob 直接抛异常；解出来的几 MB 文本塞进 textarea 后界面卡成 PPT。
- 怎么验证：dev（CDP 9421）PNG dataURL 预览正常、20 字节截断串给出「数据不完整」、\`aGVsbG8=\`→hello、3 MB 解码 780ms 且只显示 20049 字符；装机版复测后发布三处 OK。
- 下一步 / 已知问题：图片暂不随「咻」分享传输；3 MB 级解码仍是同步 ~0.8s，再大要靠「选图片」；GitHub 推送需要代理。
`;
if (!h.includes("1.15.1 · DeepSeekRuntime")) {
  h = head + "\n" + h;
  fs.writeFileSync(hp, h);
}
console.log("handoff", h.length);