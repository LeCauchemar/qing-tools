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
