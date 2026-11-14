## 2026-11-14 18:48 · 1.16.3 · DeepSeekRuntime
- 改了什么：`useProfile()` 切换数据分区后重新调用 `syncStickies()`，让桌面便条跟着分区走。
- 为什么：启动时 900ms 那次 `syncStickies()` 按本机分区执行，登录态恢复切到账号分区后没再贴，钉住的便条重启后消失。
- 怎么验证：装机版 1.16.3 启动后 `/json/list` 直接出现 `sticky.html?id=note_mwg8syvn_5`；便条内 `.pic.src` 为 `https://qing.ccyyqq.com/island/note/...`、`naturalWidth 967`；点图 `viewer.html` 同样 967。
- 下一步 / 已知问题：删除事项仍不回收云端图片对象；便条窗口位置记忆按 note.w/h 与上次坐标。

## 2026-11-14 18:30 · 1.16.2 · DeepSeekRuntime
- 改了什么：便条窗口按前缀解析图片（`cloud:` 走又拍云 CDN、其余走 `islandclip://`），`sticky.html` 的 CSP 放行 CDN；主进程的 `sticky:view` 同步分流并改用文件名当「看大图」标题；图片加载失败时给虚线占位。
- 为什么：事项同步把图片改写成 `cloud:<key>` 之后，便条还按本地文件去取，钉到桌面上就是一张破图；点开看大图也拼错了 URL，于是「这张图读不出来」。
- 怎么验证：dev 与装机版各测一遍——便条里 `.pic.src` 是 `https://qing.ccyyqq.com/island/note/...`、`naturalWidth 967`；点图后看大图窗口 `#img.naturalWidth 967`、标题 `dfba3dcd7cc14d5d3f.png`；本地文件（无 cloud 前缀）仍走 `islandclip://`。
- 下一步 / 已知问题：图片在 CDN 上只增不删（删条目不回收对象）；便条窗口启动时不会自动重建，只有 pin 动作会开窗。

## 2026-11-14 17:40 · 1.16.1 · DeepSeekRuntime

- 改了什么：小纸条页改成左频道/好友、右消息的两栏布局，面板加宽到 640px；频道与好友都改成整行竖向排列，频道上的复制/退出图标改成悬停才出现；左栏顶部加了新建频道按钮。
- 为什么：原来频道 chip 横排换行、好友条也横排，元素挤在一起还有重叠。
- 怎么验证：dev（CDP 9451，`QT_DATA_DIR=D:\temp\qt-chat`）用 `tools\m7b-audit.js` 量到面板 640×448、左栏 150×344、消息区 460×250，两两重叠 0 项；`m7b-audit2.js` 造两个频道 + 三个好友后左栏 7 个元素自上而下不重叠（频道 30px、好友 28px 行高）；`m7b-tabs.js` 六个页签 `scrollWidth == clientWidth`。
- 下一步 / 已知问题：好友区在未登录时整块隐藏（后端好友列表需要登录），登录后才会出现；`chat-new` 是直接建频道，没有单独的建频道表单。
## 2026-11-14 16:40 · 1.16.0 · DeepSeekRuntime
- 改了什么：M7 事项多端同步——服务端 `/api/items` 增量 + `changes.seq` 游标 + 冲突副本 + 图片直传又拍云；客户端主进程新增 `src/main/sync.js`（0.5s 推送 / 20s 拉取 / 云图改写），设置页加「事项同步」状态行。
- 为什么：换电脑登录后 Qing 事项要自己长出来，且不能因为两边同时改就丢字。
- 怎么验证：`node tools/test-sync.mjs` 22/22 通过（本地 3399）；dev 实测注册→本地新建→3s 内 `seq` 增长；外部设备 POST 一条 → `api.sync.pull()` 后本地出现且 `remote:true`；外部删除 → 再 pull 后本地消失；带图事项推送后正文变 `[[img:cloud:island/note/...]]`、CDN 直链 200 / image/png。
- 下一步 / 已知问题：SSE 已做但客户端目前仍用 20s 轮询；手机端未接；图片删除不会连带删云端对象。

## 2026-11-14 15:56 · 1.15.2 · DeepSeekRuntime
- 改了什么：Base64 面板把超过 20 万字符的输入搬进内存，输入框留空只显示「已读入 X」+ 复制/清空；解码/编码改从内存取数据。
- 为什么：用户截图里输入框还压着 151 万字符，界面因此一直卡——问题在 DOM 里那段文本，不在解码算法。
- 怎么验证：dev（CDP 9431）2.6 MB 图片 Base64 → 输入框长度 0、提示「已读入 2.51 MB」、解码 157 ms、预览 1400×900、连打 20 字 0 ms。
- 下一步 / 已知问题：`S.dvOut` 仍会保留完整结果（复制需要），只渲染前 2 万；图片 Base64 再大建议用「选图片」。

## 2026-11-14 15:32 · 1.15.1 · DeepSeekRuntime
- 改了什么：开发小工具的 Base64 面板支持图片双向（选图片→Base64、Base64→图片并预览/另存），解码前做清理与校验，截断的数据会被认出来；结果超过 2 万字符只显示前 2 万，单次解码上限 8 MB。
- 为什么：朋友把一段被截断的图片 Base64 粘进来，atob 直接抛异常；解出来的几 MB 文本塞进 textarea 后界面卡成 PPT。
- 怎么验证：dev（CDP 9421）PNG dataURL 预览正常、20 字节截断串给出「数据不完整」、`aGVsbG8=`→hello、3 MB 解码 780ms 且只显示 20049 字符；装机版复测后发布三处 OK。
- 下一步 / 已知问题：图片暂不随「咻」分享传输；3 MB 级解码仍是同步 ~0.8s，再大要靠「选图片」；GitHub 推送需要代理。

## 2026-11-14 15:20 · 1.15.0 · DeepSeekRuntime
- 改了什么：待办勾改回 17px 细圈（palette.css 旧规则删除）；`notes:clear` 保留钉住项和未完成待办；小纸条顶部加好友条与「咻记录」，新增 `GET /api/shares/history`；开发记录去重并按版本重排。
- 为什么：用户反馈勾太大像紫块、全部删除会误删没做完的待办、小纸条只有频道没有好友与往来记录。
- 怎么验证：dev 实测 `notes.clear()` 后保留 `ZZ-PROBE-TODO` 与用户钉住的「11」、只删掉我的测试备忘录；`api.account.shareHistory()` 返回 `{ok:true,n:0}`，弹层在岛内（截图 `shots/m6b-chat2.png`、`shots/m6b-notes.png`）；`node --check` 全通过。
- 下一步 / 已知问题：分享到好友的事项**不会自动钉桌面**（`pollShares()` 只 `notes.add`），要钉得在设置里手动钉；好友条目前只读，没有「和好友单独对话」。

## 2026-11-14 13:20 · 1.14.0 · DeepSeekRuntime
- 改了什么：M5 的后半段——`room_members` 双身份、`messages.user_id`、投票/@/拍一拍按人归并、已读按人同步；服务端 `softUser()`/`peopleOf()`，客户端 `chatFetch` 自动带 Authorization、成员列表按人合并、`chatMarkRead()`。
- 为什么：用户要求「群组跟着账号走」，换电脑、开两台设备都要是同一个人。
- 怎么验证：`tools/test-m5.mjs` 29/29 通过（身份、@、拍一拍、同人两机一票、踢人整号移出、已读增减）；dev 探针 `tools/m5-probe.js` 确认成员合并成「M5-主机（2 台）」、消息带 userId、已读归零。
- 下一步 / 已知问题：旧的消息没有 `user_id`（历史数据只按设备显示）；客户端退出登录后仍在该频道的设备，key 会退化成 deviceId，投票口径会短暂不一致。

## 2026-11-14 12:35 · 1.13.0 · DeepSeekRuntime

- 改了什么：M6 亲密好友与事项分享——服务端 bindings/shares 接口，客户端设置页好友列表（申请/同意/拒绝/解除）、Qing 事项行上的小飞机 + `#sharePop`、「咻」飞行小动画、收到时的粉色粒子散射 + 通知条 + 自动落本地事项。
- 为什么：用户要「写一条备忘录咻给对象」，且明确要「心动散射」特效。
- 怎么验证：`node tools/test-share.mjs` 16/16；dev 实例实测绑定→分享→对方收件箱→回咻→本地多一条事项且 `el.hearts` 亮起；截图 `shots/m6-share-pop.png`、`shots/m6-friends.png`。
- 下一步 / 已知问题：图片暂不随分享传输（只传文字）；还没有 SSE，靠 20 秒轮询；M7 同步协议未做。
## 2026-11-14 12:05 · 1.12.1 · DeepSeekRuntime

- 改了什么：归属账号时连笔记图片一起搬（扫 `[[img:]]`，从本机 note-images 复制到账号目录）。
- 为什么：1.12.0 只搬文字，账号分区里所有带图的笔记都变成裂图。
- 怎么验证：装机版里打开「Qing 事项」，那条带图的笔记能显示缩略图、点开能看大图。
- 下一步 / 已知问题：M5 仍只做归属 + 换机 join，消息级 user_id（多端按人归并、已读按用户）还没做。

---
## 2026-11-13 17:05 · 1.12.0 · DeepSeekRuntime

- 改了什么：备忘录与待办合并为「Qing 事项」（chip 切换、待办打勾、自动钉桌面）；固定条目删除按钮置灰；登录后本机数据可归属到账号（先导出备份）；数据按 `local` / `accounts/<uid>` 分区；频道认领 `POST /api/rooms/claim` 与 `GET /api/me/rooms`，换机自动回归；设置页底部「退出登录」。
- 为什么：账号体系只有登录没有归属，换台电脑会看到空数据；备忘录和待办分两处、钉住的条目还会被「全部删除」误删。
- 怎么验证：`QT_DATA_DIR=D:\temp\qt-m3` 验分区与归属（claimInfo 2 条 → claim → 账号分区出现 → 退出回 local 仍在）；`QT_DATA_DIR=D:\temp\qt-m4` 验 Qing 事项（chip、todo 打勾、pinned 删除置灰）；`QT_DATA_DIR=D:\temp\qt-m5` 验频道认领与回归（drop 后 sync 回来）。服务端 `tools\test-claim.mjs` 8/8。
- 下一步 / 已知问题：M5 只做了「频道归属 + 换机自动 join」，消息级 `user_id`（多端按人归并、已读按用户、@/拍一拍按账号）还没做；手机端与 Qing 事项互发是 M6/M7。

---
## 2026-11-13 13:40 · 1.11.0 · DeepSeekRuntime
- 改了什么：把仓库推上 GitHub（LeCauchemar/qing-tools），打 tag v1.11.0，建 Release 并上传 setup/portable 两个附件；package.json 补 repository/homepage，README 加 release 徽章与仓库链接。
- 为什么：用户要求源码 + 安装包同时放到 GitHub；安装包体积超过仓库单文件 100MB 限制，所以走 Release 附件（单文件上限 2GB），dist/ 继续留在 .gitignore。
- 怎么验证：git ls-remote github main 与 refs/tags/v1.11.0 都在；Release 页 assets 里两个 exe 的 size 与本地一致。
- 下一步 / 已知问题：Gitee 与 GitHub 双远端（origin=Gitee，github=GitHub），以后发版要两个都推；令牌只存在 Windows 凭据管理器，勿写进 .git/config。

# HANDOFF — 交接日志（最新在最上面）

> 规则见 [`AGENTS.md`](AGENTS.md) §8。**每个 Agent 改完东西都要在顶部追加一条**，只追加不改历史。
> 时间用 Asia/Shanghai，版本号写当时 `package.json` 的版本。

## 2026-11-13 12:42 · 1.11.0 · DeepSeekRuntime
- 改了什么：`server/upyun.mjs` 的 `putObject()` 从 `fetch` 换成 `node:https` 直发（新增 `putRaw()`，`timeout: 0`）；`AGENTS.md` §4 加第 13 条。
- 为什么：`publish.ps1` 里又拍云步骤报 `undici … HeadersTimeoutError`（300s 超时）+ `ECONNRESET`，导致 CDN 停在 1.10.11、`latest.json` MISMATCH。本机到又拍云上行约 110KB/s，101MB 安装包要 15 分钟，`fetch` 的 headers 超时必然会先炸。
- 怎么验证：`node tools/upyun-publish.mjs 1.11.0 "<notes>"` 直接跑通；portable（97MB）实测 873,927ms 上传成功，返回 `https://qing.ccyyqq.com/island/update/QingTools-1.11.0-portable.exe`。
- 下一步 / 已知问题：换机器或换网络后如果又报 300s 超时，先确认 `putRaw()` 没被改回去；`chat.ccyyqq.com/island/update/*.exe` 对 **HEAD 请求返回 404**（node 只处理 GET），用带 `Range: bytes=0-15` 的 GET 验证（会返回 206 + 完整 content-range）。
## 2026-11-13 11:40 · 1.11.0 · DeepSeekRuntime
- 改了什么：账号 M2（客户端）。新增 `src/main/account.js`（登录态 DPAPI 加密落盘、`account:*` 十个 IPC、401 自动清态）；`src/main/main.js` 挂 `registerAccountIpc()`；`src/main/preload.js` 暴露 `api.account`；`src/renderer/index.html` 设置页顶部新增「账号」组（登录/注册/恢复码/设备列表/找回/注销）；`src/renderer/app.js` 新增 `accStamp/accMsg/accRenderDevices/accPaint/accLoadStatus/accFetchSessions/accBusy/accShowCode/accHideCode/accDoLogin/accDoRegister/accDoRecover/accDoLogout/accDoDelete/bindAccountUi`，`bindUi()` 首行调 `bindAccountUi()`、`renderSettings()` 调 `accPaint()`、`boot()` 400ms 后 `accLoadStatus()`；`src/renderer/styles.css` 末尾新增「账号（1.11.0）」段。
- 为什么：账号化里程碑 M2 —— 让用户能注册/登录、看到并踢掉别的设备、换电脑也能找回（M1 只做了服务端）。
- 怎么验证：dev 实例（CDP 9371）走完整链路 —— 注册（恢复码 `9GFZ-BPKB-H3ET`，「完成」在勾选前 disabled）→ 设备列表显示「chenyuqing-life / 这台 / 今天 11:28」→ 退出本机（`accOut` 复现）→ 登录 → 用恢复码换密码（新码 `EAMA-H3FH-3G97`、旧会话被撤销）→ 注销（`check` 返回 `reserved: true`）→ 再注册 `m2keep` 后重启应用自动恢复登录（`signedIn: true`、sessions 1）→ 第二次登录造出 2 个会话、点「移除」回到 1。`tools/probe-account-file.js` 确认 `account.json` 里 `tokenEnc` 是 `dpapi:`、无明文 token。测试账号已从生产库删除（`users` 归 0）。
- 下一步 / 已知问题：本地数据仍是单 `state.json`（本地模式），`local\` 与 `accounts\<uid>\` 分区 + 「归属」卡片按方案放到 M3 一起做（现在切账号不会隔离备忘录/待办，属预期）。截图 `shots\acct-1.png`。
## 2026-11-13 10:55 · 1.10.11 · DeepSeekRuntime
- 改了什么：新增跨 Agent 协作文件 —— `AGENTS.md`（项目唯一事实来源：目录、命令、10 条硬性约束、代码地图、发版流程）、`CLAUDE.md` 与 `.github/copilot-instructions.md`（只做入口指针）、本 `HANDOFF.md`（交接日志）。
- 为什么：用户会在 Codex / Claude Code / Kimi / z-code / DeepSeekRuntime 之间轮换干活，需要一份任何客户端都能读、且**强制要求写交接**的约定。
- 怎么验证：`Get-ChildItem AGENTS.md,CLAUDE.md,HANDOFF.md,.github/copilot-instructions.md` 都在；本文件即第一条记录。
- 下一步：开始账号化 M2（客户端登录/注册/找回、设备列表、本地数据分区）。

## 2026-11-12 17:45 · 1.10.11 · DeepSeekRuntime
- 改了什么：`server/index.mjs` 新增「账号体系」整段 + 6 张表（`users/sessions/bindings/shares/items/changes`）+ 9 个接口（`/api/auth/check|register|login|recover|logout|logout-all`、`/api/me` GET/DELETE、`/api/me/sessions/:id` DELETE）；新增 `tools/test-auth.mjs`（20 项断言）。
- 为什么：账号化 M1（服务端），方案见 `docs/qing-account-plan.md`。
- 怎么验证：本地临时库 20/20 通过；部署到生产后又跑一遍 **20 passed / 0 failed**；线上 `sqlite3 .tables` 可见 16 张表；清理测试账号后数据无损（rooms 5 / messages 385 / devices 10 / stickers 1）。
- 下一步 / 坑：恢复码必须用**密码的 salt** 存 hash（独立 salt 没存过会导致找回永远失败，已修）。M2 客户端待做。
