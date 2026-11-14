import fs from "node:fs";
const p = "CHANGELOG.md";
let s = fs.readFileSync(p, "utf8");
s = s.replace("从 1.0 到 1.14.0，九天里发了 60 个可安装版本", "从 1.0 到 1.15.0，十天里发了 62 个可安装版本");
const sec = [
  "## 1.15.0 · 细圈、保守清空、好友可见（11-14）",
  "",
  "- **待办的勾**：20px 实心方块改回 17px 细圈（1.2px 描边），完成时只把圈和勾染成强调色，不再整块变紫。",
  "- **「全部删除」更保守**：保留钉在桌面的条目，以及还没做完的待办；确认提示会写清保留几条。",
  "- **小纸条有了好友**：顶部好友条 + 「咻记录」，能看见谁在什么时候咻了什么给对方（服务端 `GET /api/shares/history`）。",
  "- 顺手把开发记录里插错位置的 1.14.0 条目和被重复插入两次的 1.10.9 / 1.10.11 去重、按版本重新排序。",
  "",
  ""
].join("\n");
const anchor = "## 几个绕不过去的工程决定";
if (!s.includes(anchor)) { console.error("anchor"); process.exit(2); }
s = s.replace(anchor, sec + anchor);
fs.writeFileSync(p, s);
console.log("ok", s.length, s.includes("1.15.0"));