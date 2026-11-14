import fs from 'node:fs';

const agents = 'D:/deepseek harness daily/AGENTS.md';
{
  let s = fs.readFileSync(agents, 'utf8');
  const add = `
## M5 · 频道跟着账号走（1.14.0）

- 设备与消息都有 \`user_id\`：\`devices.user_id\`、\`messages.user_id\`、新表 \`room_members(room_id, device_id, user_id, joined_at, last_read_id)\`。
- 身份是「软」的：频道接口用 \`softUser(req)\` 读 \`Authorization: Bearer\`，没登录照旧能用，只是不记账号。
- 投票 / @ / 拍一拍都按**人**归并：key = \`u:<userId>\`（登录）或 \`<deviceId>\`（匿名）；\`peopleOf(roomId)\` 负责归并，\`personKeyOf()\` 取某台设备的 key。
- 投票目标存的是人的 key；通过时把该账号在这个频道的**所有设备**一起清掉（\`devicesOfUser\`）。
- 已读存 \`room_members.last_read_id\`，\`POST /api/rooms/:id/read\` 上报、\`GET\` 查未读；同一账号的其它设备通过 SSE \`read\` 事件清红点。
- 客户端 \`chatFetch\` 会自动带 \`Authorization\`（token 从 \`api.account.token()\` 取，主进程里方法名必须是 \`rawToken()\`——类实例的 \`this.token\` 会把同名方法覆盖掉）。
- 自测：\`node tools/test-m5.mjs\`（起 3399 临时服务端，29 条断言）。
`;
  if (!s.includes('## M5 · 频道跟着账号走')) {
    s = s.trimEnd() + '\n' + add;
    fs.writeFileSync(agents, s);
  }
  console.log('agents', s.length, s.includes('\uFFFD'));
}

const handoff = 'D:/deepseek harness daily/dynamic-island/HANDOFF.md';
{
  let s = fs.readFileSync(handoff, 'utf8');
  const entry = `## 2026-11-14 13:20 · 1.14.0 · DeepSeekRuntime
- 改了什么：M5 的后半段——\`room_members\` 双身份、\`messages.user_id\`、投票/@/拍一拍按人归并、已读按人同步；服务端 \`softUser()\`/\`peopleOf()\`，客户端 \`chatFetch\` 自动带 Authorization、成员列表按人合并、\`chatMarkRead()\`。
- 为什么：用户要求「群组跟着账号走」，换电脑、开两台设备都要是同一个人。
- 怎么验证：\`tools/test-m5.mjs\` 29/29 通过（身份、@、拍一拍、同人两机一票、踢人整号移出、已读增减）；dev 探针 \`tools/m5-probe.js\` 确认成员合并成「M5-主机（2 台）」、消息带 userId、已读归零。
- 下一步 / 已知问题：旧的消息没有 \`user_id\`（历史数据只按设备显示）；客户端退出登录后仍在该频道的设备，key 会退化成 deviceId，投票口径会短暂不一致。
`;
  if (!s.startsWith('## 2026-11-14 13:20')) {
    s = entry + '\n' + s;
    fs.writeFileSync(handoff, s);
  }
  console.log('handoff', s.length);
}
