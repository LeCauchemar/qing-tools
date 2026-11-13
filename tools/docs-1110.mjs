import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = path.join(root, 'AGENTS.md');
let s = fs.readFileSync(p, 'utf8');
const out = [];

// 1) 追加两条硬性约束（第 11/12 条）
const anchor =
  '10. **远端命令不要 `ssh host \'node -e "..."\'`**（引号会被吃两层）。改 SQL 用「本地写 .sql → scp → `sqlite3 db < file`」。';
if (!s.includes(anchor)) throw new Error('constraint 10 anchor missing');
const extra = [
  anchor,
  '11. **账号 token 落盘必须加密**：`account.json` 的 `tokenEnc` 一律 `dpapi:` 前缀（`safeStorage.encryptString`），禁止明文 token；`_call()` 遇 401 必须 `_clear()` 本地登录态，否则会一直拿废 token 打服务器。',
  '12. **测试账号用完要清**：服务端 `users` 里测试账号按设计永久占用用户名；测完用 SQL 直接删 `users` + `sessions`（本地写 .sql → scp → `sqlite3 < file`），并删掉本机 `account.json`。'
].join('\n');
s = s.split(anchor).join(extra);
out.push('constraints +2');

// 2) 进度段整体替换
const pStart = s.indexOf('## 9. 当前进度');
if (pStart < 0) throw new Error('progress section missing');
const progress = [
  '## 9. 当前进度（会随里程碑更新）',
  '',
  '- 客户端：**1.11.0**（账号 M2 已落地：设置页账号区、登录/注册/恢复码、设备列表与移除、退出/注销；登录态 DPAPI 加密、重启自动恢复）。',
  '- 账号化：M1 服务端 ✅（`/api/auth/*`、`/api/me`、设备撤销）；M2 客户端账号 ✅（2026-11-13）。方案与接口见 `docs/qing-account-plan.md` §6。',
  '- 本地数据仍是单 `state.json`（本地模式）；`local\\` 与 `accounts\\<uid>\\` 分区与「归属」卡片留到 M3 一起做。',
  '- 未做：M3 归属流程 + 数据分区、M4 Qing 事项、M5 频道跟账号、M6 分享/绑定（含「发送 Qing 事项给 xxx」，接收方仅 Windows）、M7 增量同步。',
  ''
].join('\n');
s = s.slice(0, pStart) + progress;
fs.writeFileSync(p, s, 'utf8');
out.push('progress rewritten');

// 3) 方案文档进度表
const planPath = path.join(root, 'docs', 'qing-account-plan.md');
let plan = fs.readFileSync(planPath, 'utf8');
plan = plan.replace(
  '| M2 客户端账号 | 待开始 |',
  '| M2 客户端账号 | ✅ **已完成**（2026-11-13：设置页账号区、设备列表、找回、注销） |'
);
fs.writeFileSync(planPath, plan, 'utf8');
out.push('plan progress updated');

console.log(out.join('\n'));
console.log('agents len', s.length, 'fffd', s.includes('\uFFFD'));
