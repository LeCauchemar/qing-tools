import fs from "node:fs";
const p = "AGENTS.md";
const s = fs.readFileSync(p, "utf8");
const lines = s.split("\n");
const startIdx = lines.findIndex((l) => l.startsWith("## 1.10.5 粘贴归属"));
const endIdx = lines.findIndex((l) => l.startsWith("## M6 · 亲密好友"));
if (startIdx < 0 || endIdx < 0) { console.error("bounds", startIdx, endIdx); process.exit(2); }

const moved = lines.slice(startIdx, endIdx).join("\n").trimEnd();
const archivePath = "dynamic-island/docs/agents-archive-qing-tools-2026-11.md";
const archiveHeader = `# Qing Tools 阶段性细节存档（1.10.5 → 1.12.1）

> 这些是 2026-11 那段时间逐版本记下来的细节，已经从根 \`AGENTS.md\` 挪到这里（根文件有 64KB 注入预算，超了会被截断）。
> 需要查具体某个版本的实现细节时再来这里；日常先看根文件的「铁律」和近两版记录。

`;
fs.writeFileSync(archivePath, archiveHeader + moved + "\n");

const brief = `## 旧版本细节（已归档）

> 1.10.5 → 1.12.1 的逐版本细节搬到了 [\`dynamic-island/docs/agents-archive-qing-tools-2026-11.md\`](dynamic-island/docs/agents-archive-qing-tools-2026-11.md)。下面是仍需常记的铁律：

- 备忘录（Qing 事项）编辑框是 \`contenteditable\`，图片标记 \`[[img:<file>]]\`；插图先插 \`\\u200b\` 占位再异步落盘；重绘前 \`flushLiveNote()\`，否则刚打的字被旧数据盖掉；清理测试数据只删自己建的。
- 粘贴归属看「这次在哪个框里按的」：\`e.target === el.noteInput && 有字\` → \`composeNoteWithImage()\` 合成一条；否则才用正在编辑 / 展开的那条。
- \`#editMenu\` / \`#noteMenu\` 不要各自绑 click（\`document\` 已有全局 \`[data-act]\` 委托，会执行两次）；两个菜单互斥，开一个先关另一个。
- 便条窗口：\`.paper\` 是 drag，\`.note/.tools/.foot/.rz\` 必须 no-drag；透明窗没有系统缩放边框，靠三条 \`.rz-*\` 把手 + \`sticky:resize\`。
- 账号：token 用 DPAPI 存 \`account.json\`，401 就清态；分区 \`local\\\` 与 \`accounts\\<uid>\\\`；归属 \`account:claim\` 要连 \`note-images\` 一起搬；频道认领**匹配码大小写敏感**，客户端 join 用 \`replace: true\`。
- 频道跟账号：\`room_members\` + \`messages.user_id\`，投票/@/拍一拍按人归并（key \`u:<uid>\`），已读存 \`last_read_id\`；老设备用 \`POST /api/rooms/:id/attach\` 补挂。
- 主题对比度：次要文字一律 \`color-mix(in srgb, var(--ink) N%, transparent)\`；原生控件要 \`color-scheme\` 才不在深色下黑字黑底。
- 边缘彩虹画在 \`.island\` 内侧（\`inset: 0\`）+ \`conic-gradient\` + \`@property\` 转角度；画到外侧会被 \`overflow:hidden\` 裁成一条线。

`;

// 同时把 m.testH5 段也搬走（另一个项目，不占本项目的注入预算）
let body = lines.slice(0, startIdx).join("\n") + "\n" + brief + lines.slice(endIdx).join("\n");
const t0 = body.indexOf("## \`m.testH5.ccyyqq.com\`");
if (t0 >= 0) {
  const t1 = body.indexOf("\n## ", t0 + 5);
  const testH5 = body.slice(t0, t1 > 0 ? t1 : undefined);
  body = body.slice(0, t0) + body.slice(t1 > 0 ? t1 + 1 : body.length);
  const ap2 = "dynamic-island/docs/agents-archive-face-liveness.md";
  fs.writeFileSync(ap2, "# m.testH5.ccyyqq.com 人脸活体验证 H5（从根 AGENTS.md 归档）\n\n> 独立项目，细节见项目自己的 README 与 deploy 脚本。\n\n" + testH5 + "\n");
  body = body.replace(/## 工具约束/, "## 其它项目\n\n- **`m.testH5.ccyyqq.com`** 阿里云人脸活体验证 H5：源码 `face-liveness-h5\\`，systemd `face-liveness.service`（127.0.0.1:3121），细节见 [`dynamic-island/docs/agents-archive-face-liveness.md`](dynamic-island/docs/agents-archive-face-liveness.md)。\n\n## 工具约束");
}
fs.writeFileSync(p, body);
console.log("bytes now", Buffer.byteLength(body), "chars", body.length, "fffd", body.includes("\uFFFD"));
console.log("archive", Buffer.byteLength(moved));