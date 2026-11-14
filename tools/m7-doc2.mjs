import fs from "node:fs";
const agents = "D:\\deepseek harness daily\\AGENTS.md";
let a = fs.readFileSync(agents, "utf8");
const add = [
  "",
  "## 1.15.0 · 清空规则 / 小纸条好友 / 记录排序",
  "",
  "- **「全部删除」保留谁**：`notes:clear` 的过滤条件是 `n.pinned || (n.kind === 'todo' && !n.done)` —— 钉在桌面的和没做完的待办都不删；渲染层确认提示要把这两类分别数出来。",
  "- **`.check-btn` 只有一个来源**：`styles.css` 里 17px、1.2px 描边、`background: transparent`；`palette.css` 里旧的 `.check-btn` 规则必须删掉，否则会覆盖成 20px 圆角方块，点完成时像一大块紫块。",
  "- **小纸条好友条**：`renderChatPeople()` 渲染 `#cpList`，「咻记录」走 `openShareHist()` → 服务端 `GET /api/shares/history`（最近 100 条收发）。弹层坐标必须夹在 `#island` 矩形内（`.island` 是 `overflow:hidden`，超出会被裁掉），不能只按 `window.innerWidth` 夹。",
  "- **开发记录插入位置**：不要再用 `lastIndexOf('</section>')`，历史上 1.14.0 因此插到了 1.10.x 中间；`tools/m7-changelog.mjs` 会抓出所有 `article.cl-item`、按版本号排序去重后再追加新条目，以后改记录沿用这个脚本。",
  ""
].join("\n");
if (!a.includes("## 1.15.0")) a = a.trimEnd() + "\n" + add;
fs.writeFileSync(agents, a);

const handoff = "HANDOFF.md";
let h = fs.readFileSync(handoff, "utf8");
const entry = [
  "## 2026-11-14 15:20 · 1.15.0 · DeepSeekRuntime",
  "- 改了什么：待办勾改回 17px 细圈（palette.css 旧规则删除）；`notes:clear` 保留钉住项和未完成待办；小纸条顶部加好友条与「咻记录」，新增 `GET /api/shares/history`；开发记录去重并按版本重排。",
  "- 为什么：用户反馈勾太大像紫块、全部删除会误删没做完的待办、小纸条只有频道没有好友与往来记录。",
  "- 怎么验证：dev 实测 `notes.clear()` 后保留 `ZZ-PROBE-TODO` 与用户钉住的「11」、只删掉我的测试备忘录；`api.account.shareHistory()` 返回 `{ok:true,n:0}`，弹层在岛内（截图 `shots/m6b-chat2.png`、`shots/m6b-notes.png`）；`node --check` 全通过。",
  "- 下一步 / 已知问题：分享到好友的事项**不会自动钉桌面**（`pollShares()` 只 `notes.add`），要钉得在设置里手动钉；好友条目前只读，没有「和好友单独对话」。",
  ""
].join("\n");
if (!h.includes("2026-11-14 15:20")) h = h.replace(/^/, entry + "\n");
fs.writeFileSync(handoff, h);
console.log("agents", a.length, a.includes("1.15.0"), "handoff", h.length, h.includes("1.15.0"));