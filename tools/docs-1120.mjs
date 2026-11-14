import fs from 'node:fs';

function check(p) {
  const s = fs.readFileSync(p, 'utf8');
  return { p, len: s.length, fffd: s.includes('\uFFFD'), bom: s.charCodeAt(0) === 0xfeff };
}
for (const p of ['README.md', 'CHANGELOG.md', 'site/changelog.html', 'site/index.html']) {
  const r = check(p);
  console.log(r.p, r.len, 'fffd=' + r.fffd, 'bom=' + r.bom);
}

const rd = fs.readFileSync('README.md', 'utf8');
const lines = rd.split(/\r?\n/);
for (let i = 0; i < lines.length; i += 1) {
  if (lines[i].startsWith('| **Qing 事项**') || lines[i].startsWith('| **频道跟账号**') || lines[i].startsWith('| **小工具**')) {
    console.log((i + 1) + ': ' + lines[i].slice(0, 110));
  }
}

// AGENTS.md 追加 1.12.0 一条
const agPath = 'D:/deepseek harness daily/AGENTS.md';
let ag = fs.readFileSync(agPath, 'utf8');
if (!ag.includes('## 1.12.0 · M3/M4/M5')) {
  const block = [
    '',
    '## 1.12.0 · M3/M4/M5（账号归属、Qing 事项、频道跟账号）',
    '',
    '- 本机数据与账号数据分区：`DATA_DIR\\state.json`（local）与 `DATA_DIR\\accounts\\<uid>\\state.json`（account），`store.use(file)` 在登录/退出时切换；`QT_DATA_DIR` 环境变量可把整个数据目录指向临时目录做测试。',
    '- 归属卡片：`api.account.claimInfo()` 数本机条数，`claim()` 用 `mergeById` 并进账号分区，写完给本机 `meta.claimedBy` 打标（只认领一次）。先给人「导出备份」（`app:exportBackup` 落到文档目录）再认领。',
    '- Qing 事项：`notes:add(text, kind)` 的 `kind = note|todo`，`notes:done` 切换完成；老 `todos` 由 `migrateQingItems()` 一次性并进 notes；待办新建自动 `togglePin`；`pinned` 的删除按钮一律置灰。',
    '- 频道归属：服务端 `rooms.owner_user_id` + `POST /api/rooms/claim`（先到先得，被认领过 409 `taken`）+ `GET /api/me/rooms`；客户端 `claimLocalRooms()` 登录后认领、`syncAccountRooms()` 用 `replace: true` 重新 join 回来（不替换会因同名设备失败）。',
    '- 匹配码大小写敏感：认领/查询只去空白，**绝不要 toUpperCase**。',
    '',
    '---',
    ''
  ].join('\n');
  ag = ag + block;
  fs.writeFileSync(agPath, ag, 'utf8');
}
console.log('agents', ag.length, ag.includes('## 1.12.0 · M3/M4/M5'));

// HANDOFF.md 顶部插入
const hoPath = 'HANDOFF.md';
let ho = fs.readFileSync(hoPath, 'utf8');
if (!ho.includes('1.12.0 · DeepSeekRuntime')) {
  const entry = [
    '## 2026-11-13 17:05 · 1.12.0 · DeepSeekRuntime',
    '',
    '- 改了什么：备忘录与待办合并为「Qing 事项」（chip 切换、待办打勾、自动钉桌面）；固定条目删除按钮置灰；登录后本机数据可归属到账号（先导出备份）；数据按 `local` / `accounts/<uid>` 分区；频道认领 `POST /api/rooms/claim` 与 `GET /api/me/rooms`，换机自动回归；设置页底部「退出登录」。',
    '- 为什么：账号体系只有登录没有归属，换台电脑会看到空数据；备忘录和待办分两处、钉住的条目还会被「全部删除」误删。',
    '- 怎么验证：`QT_DATA_DIR=D:\\temp\\qt-m3` 验分区与归属（claimInfo 2 条 → claim → 账号分区出现 → 退出回 local 仍在）；`QT_DATA_DIR=D:\\temp\\qt-m4` 验 Qing 事项（chip、todo 打勾、pinned 删除置灰）；`QT_DATA_DIR=D:\\temp\\qt-m5` 验频道认领与回归（drop 后 sync 回来）。服务端 `tools\\test-claim.mjs` 8/8。',
    '- 下一步 / 已知问题：M5 只做了「频道归属 + 换机自动 join」，消息级 `user_id`（多端按人归并、已读按用户、@/拍一拍按账号）还没做；手机端与 Qing 事项互发是 M6/M7。',
    '',
    '---',
    ''
  ].join('\n');
  ho = entry + ho;
  fs.writeFileSync(hoPath, ho, 'utf8');
}
console.log('handoff', ho.length);
