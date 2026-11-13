import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 1) AGENTS.md：约束里补一条「又拍云大文件上传」
const aPath = path.join(root, 'AGENTS.md');
let a = fs.readFileSync(aPath, 'utf8');
const c12 = '12. **测试账号用完要清**：服务端 `users` 里测试账号按设计永久占用用户名；测完用 SQL 直接删 `users` + `sessions`（本地写 .sql → scp → `sqlite3 < file`），并删掉本机 `account.json`。';
const c13 = [
  '',
  '13. **又拍云上传 100MB 安装包不能用 `fetch`**：Node 的 undici 有 300s headers 超时，上行 ~110KB/s 时必炸（`UND_ERR_HEADERS_TIMEOUT` / `ECONNRESET`）。`server/upyun.mjs` 的 `putRaw()` 已改用 `node:https` 不限时（一次上传约 15 分钟，属正常）。别改回 `fetch`，也别因为「传得慢」就以为脚本卡死。'
].join('\n');
if (!a.includes(c12)) throw new Error('AGENTS c12 anchor missing');
if (!a.includes('13. **又拍云上传 100MB')) a = a.replace(c12, c12 + c13);
fs.writeFileSync(aPath, a, 'utf8');
console.log('agents ok', a.length, a.includes('13. **又拍云上传 100MB'));

// 2) HANDOFF.md：顶部追加一条（只追加，不改历史）
const hPath = path.join(root, 'HANDOFF.md');
let h = fs.readFileSync(hPath, 'utf8');
const entry = [
  '## 2026-11-13 12:42 · 1.11.0 · DeepSeekRuntime',
  '- 改了什么：`server/upyun.mjs` 的 `putObject()` 从 `fetch` 换成 `node:https` 直发（新增 `putRaw()`，`timeout: 0`）；`AGENTS.md` §4 加第 13 条。',
  '- 为什么：`publish.ps1` 里又拍云步骤报 `undici … HeadersTimeoutError`（300s 超时）+ `ECONNRESET`，导致 CDN 停在 1.10.11、`latest.json` MISMATCH。本机到又拍云上行约 110KB/s，101MB 安装包要 15 分钟，`fetch` 的 headers 超时必然会先炸。',
  '- 怎么验证：`node tools/upyun-publish.mjs 1.11.0 "<notes>"` 直接跑通；portable（97MB）实测 873,927ms 上传成功，返回 `https://qing.ccyyqq.com/island/update/QingTools-1.11.0-portable.exe`。',
  '- 下一步 / 已知问题：换机器或换网络后如果又报 300s 超时，先确认 `putRaw()` 没被改回去；`chat.ccyyqq.com/island/update/*.exe` 对 **HEAD 请求返回 404**（node 只处理 GET），用带 `Range: bytes=0-15` 的 GET 验证（会返回 206 + 完整 content-range）。',
  ''
].join('\n');
const anchor = '## 2026-11-13 11:40 · 1.11.0 · DeepSeekRuntime';
const i = h.indexOf(anchor);
if (i < 0) throw new Error('HANDOFF anchor missing');
h = h.slice(0, i) + entry + h.slice(i);
fs.writeFileSync(hPath, h, 'utf8');
console.log('handoff ok', h.length, 'fffd', h.includes('\uFFFD'));
