import fs from "node:fs";
const p = "docs/qing-account-plan.md";
let s = fs.readFileSync(p, "utf8");
const rep = [
  ["| M3 归属流程 | 待开始 |", "| M3 归属流程 | ✅ **已完成**（1.12.0：分区 `local\\`/`accounts\\<uid>\\`、归属卡片、备份导出、频道先到先得认领 + 换机自动 join） |"],
  ["| M4 Qing事项 | 待开始 |", "| M4 Qing事项 | ✅ **已完成**（1.12.0：备忘录/待办合并、chip 选类型、打勾、自动钉桌面、固定与删除保护；待办浮窗未做，用自动钉桌面代替） |"],
  ["| M5 频道跟账号 | 待开始 |", "| M5 频道跟账号 | ✅ **已完成**（1.14.0：`room_members`、消息 `user_id`、投票/@/拍一拍按人归并、已读按用户；1.14.0 补 `attach` 老设备补挂） |"],
  ["| M6 分享 + 绑定 | 待开始 |", "| M6 分享 + 绑定 | ✅ **已完成**（1.13.0：双向绑定上限 3、咻给小飞机 + 心动粒子 + 通知；图片暂不随分享传输） |"],
  ["| M7 同步协议 | 待开始 |", "| M7 同步协议 | ⬜ 待开始（`/api/items` 增量同步 + SSE + 冲突副本；`items`/`changes` 表 M1 已建好，接口未接） |"]
];
let hit = 0;
for (const [a, b] of rep) { if (s.includes(a)) { s = s.replace(a, b); hit++; } }
fs.writeFileSync(p, s);
console.log("rows updated", hit, "len", s.length, "fffd", s.includes("\uFFFD"));