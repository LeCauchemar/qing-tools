import fs from "node:fs";
const ap = "..\\AGENTS.md";
let a = fs.readFileSync(ap, "utf8");
if (!a.includes("## 1.15.2 · 超长 Base64")) {
  a += `
## 1.15.2 · 超长 Base64 不驻留输入框（2026-11-14）

- 根因不是解码慢，而是**几百万字符一直留在 \`<textarea id="dvIn">\` 里**：每次 input/滚动/切页签都要整段重排，动画直接掉成 PPT。
- \`S.dvSrc\` + \`dvSetSrc/dvClearSrc/dvPayload()/dvPaintSrc()\`：超过 \`B64_INLINE_MAX = 200000\` 的输入搬到内存，输入框清空，\`#dvSrcBar\` 显示「已读入 X」+ 复制/清空，解码/编码从 \`dvPayload()\` 取数据。
- 三条入口都要拦：\`paste\`（>20 万直接 hoist）、\`input\`（兜底）、\`dvRun()\` 开头（历史遗留的大串）。
- 清空要一并 \`dvClearImage()\` + \`S.dvOut=''\`，否则内存里还留着预览 blob 和结果串。

`;
  fs.writeFileSync(ap, a);
}
const hp = "HANDOFF.md";
let h = fs.readFileSync(hp, "utf8");
const head = `## 2026-11-14 15:56 · 1.15.2 · DeepSeekRuntime
- 改了什么：Base64 面板把超过 20 万字符的输入搬进内存，输入框留空只显示「已读入 X」+ 复制/清空；解码/编码改从内存取数据。
- 为什么：用户截图里输入框还压着 151 万字符，界面因此一直卡——问题在 DOM 里那段文本，不在解码算法。
- 怎么验证：dev（CDP 9431）2.6 MB 图片 Base64 → 输入框长度 0、提示「已读入 2.51 MB」、解码 157 ms、预览 1400×900、连打 20 字 0 ms。
- 下一步 / 已知问题：\`S.dvOut\` 仍会保留完整结果（复制需要），只渲染前 2 万；图片 Base64 再大建议用「选图片」。
`;
if (!h.includes("1.15.2 · DeepSeekRuntime")) { h = head + "\n" + h; fs.writeFileSync(hp, h); }
console.log("agents", a.length, "handoff", h.length);