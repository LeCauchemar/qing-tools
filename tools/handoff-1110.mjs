import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = path.join(root, 'HANDOFF.md');
let s = fs.readFileSync(p, 'utf8');

const entry = [
  '## 2026-11-13 11:40 · 1.11.0 · DeepSeekRuntime',
  '- 改了什么：账号 M2（客户端）。新增 `src/main/account.js`（登录态 DPAPI 加密落盘、`account:*` 十个 IPC、401 自动清态）；`src/main/main.js` 挂 `registerAccountIpc()`；`src/main/preload.js` 暴露 `api.account`；`src/renderer/index.html` 设置页顶部新增「账号」组（登录/注册/恢复码/设备列表/找回/注销）；`src/renderer/app.js` 新增 `accStamp/accMsg/accRenderDevices/accPaint/accLoadStatus/accFetchSessions/accBusy/accShowCode/accHideCode/accDoLogin/accDoRegister/accDoRecover/accDoLogout/accDoDelete/bindAccountUi`，`bindUi()` 首行调 `bindAccountUi()`、`renderSettings()` 调 `accPaint()`、`boot()` 400ms 后 `accLoadStatus()`；`src/renderer/styles.css` 末尾新增「账号（1.11.0）」段。',
  '- 为什么：账号化里程碑 M2 —— 让用户能注册/登录、看到并踢掉别的设备、换电脑也能找回（M1 只做了服务端）。',
  '- 怎么验证：dev 实例（CDP 9371）走完整链路 —— 注册（恢复码 `9GFZ-BPKB-H3ET`，「完成」在勾选前 disabled）→ 设备列表显示「chenyuqing-life / 这台 / 今天 11:28」→ 退出本机（`accOut` 复现）→ 登录 → 用恢复码换密码（新码 `EAMA-H3FH-3G97`、旧会话被撤销）→ 注销（`check` 返回 `reserved: true`）→ 再注册 `m2keep` 后重启应用自动恢复登录（`signedIn: true`、sessions 1）→ 第二次登录造出 2 个会话、点「移除」回到 1。`tools/probe-account-file.js` 确认 `account.json` 里 `tokenEnc` 是 `dpapi:`、无明文 token。测试账号已从生产库删除（`users` 归 0）。',
  '- 下一步 / 已知问题：本地数据仍是单 `state.json`（本地模式），`local\\` 与 `accounts\\<uid>\\` 分区 + 「归属」卡片按方案放到 M3 一起做（现在切账号不会隔离备忘录/待办，属预期）。截图 `shots\\acct-1.png`。',
  ''
].join('\n');

const marker = '## 2026-11-13 10:55 · 1.10.11 · DeepSeekRuntime';
const i = s.indexOf(marker);
if (i < 0) throw new Error('handoff anchor missing');
s = s.slice(0, i) + entry + s.slice(i);
fs.writeFileSync(p, s, 'utf8');
console.log('ok', s.length, 'fffd', s.includes('\uFFFD'));
