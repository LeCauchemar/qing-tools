import fs from 'node:fs';

const AG = 'D:/deepseek harness daily/AGENTS.md';
const HO = 'D:/deepseek harness daily/dynamic-island/HANDOFF.md';

const agentsBlock = `
## 1.16.3 · 重启后便条还贴在桌上（2026-11-14）

1. 启动时序：\`whenReady()\` 里 900ms 就叫了一次 \`syncStickies()\`，那时 store 还停在**本机分区**（登录态是异步恢复的）；等 \`useProfile({kind:'account'})\` 把 store 切到 \`accounts/<uid>/state.json\` 之后没人再贴，于是「钉在桌面」的便条在重启后整批消失。
2. 修法：\`useProfile()\` 在 \`store.use(stateFileFor())\` + \`migrateQingItems()\` 之后调用 \`syncStickies()\`。函数声明是提升的，但为稳妥仍用 \`typeof syncStickies === 'function'\` 判断。
3. 任何「切分区后要重算的东西」都要挂在 \`useProfile()\` 里：剪贴板已 \`hydrate()\`、便条现在也 \`syncStickies()\`；以后再加（比如本地图片缓存索引）同理。
4. 验证：装了 1.16.3 后带 \`--remote-debugging-port\` 启动，\`/json/list\` 里**直接就有** \`sticky.html?id=<noteId>\`（1.16.2 时只有 index.html），\`.pic.naturalWidth 967\`，点图后 \`viewer.html\` 同样 967。
`;

let ag = fs.readFileSync(AG, 'utf8');
if (!ag.includes('## 1.16.3 · 重启后便条还贴在桌上')) ag = ag.replace(/\s*$/, '\n') + agentsBlock;
fs.writeFileSync(AG, ag, 'utf8');

const handoff = `## 2026-11-14 18:48 · 1.16.3 · DeepSeekRuntime
- 改了什么：\`useProfile()\` 切换数据分区后重新调用 \`syncStickies()\`，让桌面便条跟着分区走。
- 为什么：启动时 900ms 那次 \`syncStickies()\` 按本机分区执行，登录态恢复切到账号分区后没再贴，钉住的便条重启后消失。
- 怎么验证：装机版 1.16.3 启动后 \`/json/list\` 直接出现 \`sticky.html?id=note_mwg8syvn_5\`；便条内 \`.pic.src\` 为 \`https://qing.ccyyqq.com/island/note/...\`、\`naturalWidth 967\`；点图 \`viewer.html\` 同样 967。
- 下一步 / 已知问题：删除事项仍不回收云端图片对象；便条窗口位置记忆按 note.w/h 与上次坐标。

`;
let ho = fs.readFileSync(HO, 'utf8');
if (!ho.includes('1.16.3 · DeepSeekRuntime')) ho = handoff + ho;
fs.writeFileSync(HO, ho, 'utf8');
console.log('agents', ag.length, ag.includes('\uFFFD'), 'handoff', ho.length);
