import fs from 'node:fs';

// AGENTS.md 追加 M6 段
const agents = 'D:/deepseek harness daily/AGENTS.md';
let a = fs.readFileSync(agents, 'utf8');
if (!a.includes('## M6 · 亲密好友 + 咻分享')) {
  const sec = [
    '',
    '## M6 · 亲密好友 + 咻分享（1.13.0）',
    '- 服务端 `bindings`（双向各一行，`status=pending|accepted`）+ `shares`（snapshot + new_item_id）+ `items`（收件人副本，`origin` 记来源）三张表在 M1 就建好了，M6 只补接口：`GET/POST /api/bindings`、`POST /api/bindings/:id/accept|reject`、`DELETE /api/bindings/:id`、`POST /api/shares`、`GET /api/shares/inbox`、`POST /api/shares/:id/read`。',
    '- 绑定上限 3：`acceptedFriends()` 返回带 `bindId`（解除时要的是绑定行 id，不是用户 id）；申请时如果对面已经有发给我的 pending，直接双向 accepted。',
    '- 分享 = 复制：服务端给收件人插一条独立 `items` 行 + 写 `changes`，分享本身只做投递；客户端收到后 `api.notes.add(text, kind)` 落本地再 `shareRead` 标记已读，**不要**把远端 itemId 当本地 id。',
    '- 客户端 `pollShares()` 每 20 秒 + 登录后立刻跑一次（没有 SSE，先这样够用）；收到时 `heartBurst()` 画 40 个粉色粒子 900ms，再 `showPeek`。面板开着时 peek 会被吞，所以额外加一条 toast。',
    '- `#sharePop` 与 `#hearts` 都挂 `#stage` 直属；document click 要排除 `[data-act="note-share"]`，否则点开即被关。',
    '- 自测：`node tools\\test-share.mjs`（本地临时服务器 16 项）；测试账号用完要在生产库删 `users/sessions/bindings/shares/items`。',
    ''
  ].join('\n');
  a += sec;
  fs.writeFileSync(agents, a);
}

// HANDOFF.md 顶部插一条
const handoff = 'D:/deepseek harness daily/dynamic-island/HANDOFF.md';
let h = fs.readFileSync(handoff, 'utf8');
if (!h.includes('## 2026-11-14 12:35 · 1.13.0')) {
  const entry = [
    '## 2026-11-14 12:35 · 1.13.0 · DeepSeekRuntime',
    '',
    '- 改了什么：M6 亲密好友与事项分享——服务端 bindings/shares 接口，客户端设置页好友列表（申请/同意/拒绝/解除）、Qing 事项行上的小飞机 + `#sharePop`、「咻」飞行小动画、收到时的粉色粒子散射 + 通知条 + 自动落本地事项。',
    '- 为什么：用户要「写一条备忘录咻给对象」，且明确要「心动散射」特效。',
    '- 怎么验证：`node tools/test-share.mjs` 16/16；dev 实例实测绑定→分享→对方收件箱→回咻→本地多一条事项且 `el.hearts` 亮起；截图 `shots/m6-share-pop.png`、`shots/m6-friends.png`。',
    '- 下一步 / 已知问题：图片暂不随分享传输（只传文字）；还没有 SSE，靠 20 秒轮询；M7 同步协议未做。',
    ''
  ].join('\n');
  h = entry + h;
  fs.writeFileSync(handoff, h);
}

console.log('docs ok', fs.readFileSync(agents, 'utf8').includes('M6 · 亲密好友'), fs.readFileSync(handoff, 'utf8').includes('1.13.0'));
