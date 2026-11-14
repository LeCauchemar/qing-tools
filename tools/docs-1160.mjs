// 1.16.0：AGENTS.md + HANDOFF.md
import fs from 'node:fs';

const agentsPath = 'D:\\deepseek harness daily\\AGENTS.md';
const handoffPath = 'HANDOFF.md';

let a = fs.readFileSync(agentsPath, 'utf8');
if (!a.includes('## M7 · 事项同步（1.16.0）')) {
  const block = `## M7 · 事项同步（1.16.0）

- 服务端：\`GET /api/items?since=\`（\`since=0\` 给全量快照，之后按 \`changes.seq\` 拉增量，墓碑 \`deleted:true\` 也在里面）、\`POST /api/items\`、\`PATCH /api/items/:id\`、\`DELETE /api/items/:id\`（钉住的返回 409 \`pinned\`）、\`POST /api/items/image\`（裸二进制 → 又拍云）、\`GET /api/sync/stream\`（SSE，**EventSource 不能带 header，所以这条允许 \`?token=\`**，见 \`requireUserSse\`）。
- 冲突：客户端 PATCH 带 \`baseUpdatedAt\`；服务器发现 \`row.updated_at > base + 500\` 且文本不同，就把**被覆盖的那版**另存一条 \`origin = {conflict:true, of:...}\`，界面上显示「另一台设备改过的版本」。
- 客户端主进程 \`src/main/sync.js\`：本地 notes 是唯一真相，改完 500ms 防抖推送，20s 轮询；推送前把正文里的 \`[[img:<file>]]\` 上传又拍云并改写成 \`[[img:cloud:<key>]]\`（\`meta.cloudImgs\` 缓存，同一文件只传一次）。
- \`sync.js\` 里取账号实例必须 \`accountMod.account()\` —— \`require('./account').account\` 是个**函数**，直接当对象用会让 \`signedIn\` 永远 undefined（推送静默不发生，status 里也看不到 signedIn 字段）。
- 渲染层 \`imgSrcOf(file)\`：\`cloud:<key>\` → \`S.cloudBase + '/' + key\`（\`/api/cloud\` 拿域名），其余走 \`islandclip://note/<file>\`；\`undefined\`/\`null\` 直接返回空串，别拼出 \`islandclip://note/undefined\`。

`;
  a = a.replace('旧版本细节（已归档）', block + '旧版本细节（已归档）');
  fs.writeFileSync(agentsPath, a);
}

let h = fs.readFileSync(handoffPath, 'utf8');
if (!h.includes('## 2026-11-14 16:40 · 1.16.0')) {
  const entry = `## 2026-11-14 16:40 · 1.16.0 · DeepSeekRuntime
- 改了什么：M7 事项多端同步——服务端 \`/api/items\` 增量 + \`changes.seq\` 游标 + 冲突副本 + 图片直传又拍云；客户端主进程新增 \`src/main/sync.js\`（0.5s 推送 / 20s 拉取 / 云图改写），设置页加「事项同步」状态行。
- 为什么：换电脑登录后 Qing 事项要自己长出来，且不能因为两边同时改就丢字。
- 怎么验证：\`node tools/test-sync.mjs\` 22/22 通过（本地 3399）；dev 实测注册→本地新建→3s 内 \`seq\` 增长；外部设备 POST 一条 → \`api.sync.pull()\` 后本地出现且 \`remote:true\`；外部删除 → 再 pull 后本地消失；带图事项推送后正文变 \`[[img:cloud:island/note/...]]\`、CDN 直链 200 / image/png。
- 下一步 / 已知问题：SSE 已做但客户端目前仍用 20s 轮询；手机端未接；图片删除不会连带删云端对象。

`;
  h = entry + h;
  fs.writeFileSync(handoffPath, h);
}
console.log(JSON.stringify({ agents: a.length, handoff: h.length, ok: a.includes('M7 · 事项同步') && h.includes('1.16.0') }));
