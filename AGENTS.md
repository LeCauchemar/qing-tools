# AGENTS.md — Qing Tools 项目协作约定（跨 Agent 通用）

> 本文件是本仓库的**唯一事实来源（single source of truth）**，任何编码 Agent（Codex / Claude Code / Kimi CLI / Cursor / Zed / DeepSeekRuntime / 其它）在动手前都必须先读它。
> `CLAUDE.md`、`.github/copilot-instructions.md` 只是指向本文件的入口，内容不要重复维护。
> **每次改动都要写交接记录**：见文末《变更交接协议》，记录写进 [`HANDOFF.md`](HANDOFF.md)。

---

## 1. 项目是什么

**Qing Tools**（原「灵动岛」）—— Windows 顶部常驻的「灵动岛 / 刘海」桌面工具。

- 七个页签：邮件（多账户 IMAP + 验证码抽取）、备忘录（富文本 + 图片 + 桌面便签）、剪贴板历史、文件暂存与整机搜索、小纸条（群聊）、小工具（计时/待办/免打扰/开发小工具/天气/提醒/倒数日/短信同步）、设置。
- 技术栈：Electron 45（Chromium 156 / Node 24）+ 原生 HTML/CSS/JS（**无打包器、无框架**）+ 一个零依赖 Node 服务端（SQLite）。
- 版本：见 `package.json` 的 `version`（当前 1.10.11）。发布产物：NSIS 安装包 + 便携版。

## 2. 目录结构

```
src/main/            Electron 主进程
  main.js            入口：窗口/托盘/单实例/IPC/指针穿透/提醒 tick/更新器（~2000 行）
  store.js           数据层：JSON 持久化 + DEFAULTS + 迁移
  preload.js         主窗口 IPC 白名单（contextBridge）
  sticky-preload.js  桌面便签窗口 IPC
  viewer-preload.js  看大图窗口 IPC
  mail.js            IMAP 多账户 + 验证码/链接分析（依赖 mail-text.js）
  search.js          Everything HTTP 优先 + 内置 BFS 兜底
  everything.js      Everything 安装/拉起/写 ini/探活
  ms-oauth.js        微软 OAuth2 设备码
  sysinfo.js         CPU/内存/网速/电量
  account.js         账号客户端（M2 新增：登录态/设备/云端账号接口）
src/renderer/        渲染层（无框架）
  index.html         主界面 + SVG sprite + 七个页签 + 设置页
  app.js             全部交互逻辑（~7000 行，单文件，按区块注释）
  styles.css         全部样式（~5400 行，主题变量 + 状态机 + 组件）
  palette.css        命令面板/全域搜索
  sticky.html/js/css 桌面便签窗口
  viewer.html/js/css 看大图窗口（缩放/平移）
server/              小纸条 + 账号后端（零依赖 Node + SQLite，部署在 81.70.254.230）
site/                官网（静态，qingtools.ccyyqq.com）+ changelog.html
deploy/              部署脚本（deploy.ps1 服务端 / site.ps1 官网 / publish.ps1 发版）
tools/               一次性脚本与测试（探针、CDP 截图、打包校验、账号自测）
build/               electron-builder 配置与图标（afterPack.js 瘦身）
vendor/everything/   内置 Everything 安装包
docs/                设计文档（qing-account-plan.md = 账号化方案与里程碑）
shots/               截图（README 引用的几张已入库）
```

## 3. 常用命令（Windows / PowerShell 5.1）

```powershell
# 开发（会抢占单实例锁，先杀掉已装的版本）
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
.\node_modules\electron\dist\electron.exe . --dev --remote-debugging-port=9333

# 打包（先杀 dev 进程）
npx electron-builder --win            # 产物 dist\QingTools-<ver>-setup.exe / -portable.exe
npx electron-builder --dir --win      # 只解包，快

# 装机（静默）
Start-Process dist\QingTools-<ver>-setup.exe -ArgumentList '/S' -Wait

# 服务端部署 / 官网部署 / 一条命令发版（含官网）
& .\deploy\deploy.ps1
& .\deploy\site.ps1
& .\deploy\publish.ps1 -Version 1.10.12 -Notes "..."
```

## 4. 硬性约束（踩过坑，违反会坏数据）

1. **任何文本文件都不许用 PowerShell 文本往返**（`Get-Content -Raw | Set-Content`）—— 会按 GBK 解码 UTF-8，中文全毁且不报错。改文件用 `read/write/edit` 工具或 Node 脚本（`fs.readFileSync(p,'utf8')`）。
2. **启动 Electron 前删掉 `ELECTRON_RUN_AS_NODE`**：本机 shell 常驻该变量，`Start-Process` 会继承它，Electron 被当 node 跑 → 装好的 exe「一闪就退、日志一个字不写」。
3. **只按精确进程名杀进程**：`Stop-Process -Name 'Qing Tools'`；绝不 `-Name electron`（会误杀用户其它 Electron 应用）。
4. **数据目录固定 `%APPDATA%\DynamicIsland`**（`app.setPath('userData')`）。产品改名也不许改它，否则用户数据全丢。
5. **测试只删自己刚创建的数据**。历史上 `for (const n of S.data.notes) await api.notes.remove(n.id)` 删光过用户三条真实备忘录且无备份。任何批量删除前先按前缀/时间过滤。
6. **破坏性交互只在临时频道/临时数据里试**（退出频道、投票踢人、注销、清空），测完 `purgeRoom` 清理。
7. **`.island` 的 `--isl-h` 只能写在 `#stage` 上**：`#stage[data-state="panel"] .island{--isl-h:448px}` 这类写法会盖掉内联变量，症状是「拖了但高度不动」。
8. **垂直布局里的图片必须 `align-self: flex-start`**（`.row-main` 是 flex column，否则小图被拉成整行宽）。
9. **Electron 45 的 `clipboard` 是 W3C 异步 API**：只有 `read()/write(items)/writeText/readText`，没有 `readImage()/writeImage()`。
10. **远端命令不要 `ssh host 'node -e "..."'`**（引号会被吃两层）。改 SQL 用「本地写 .sql → scp → `sqlite3 db < file`」。
11. **账号 token 落盘必须加密**：`account.json` 的 `tokenEnc` 一律 `dpapi:` 前缀（`safeStorage.encryptString`），禁止明文 token；`_call()` 遇 401 必须 `_clear()` 本地登录态，否则会一直拿废 token 打服务器。
12. **测试账号用完要清**：服务端 `users` 里测试账号按设计永久占用用户名；测完用 SQL 直接删 `users` + `sessions`（本地写 .sql → scp → `sqlite3 < file`），并删掉本机 `account.json`。
13. **又拍云上传 100MB 安装包不能用 `fetch`**：Node 的 undici 有 300s headers 超时，上行 ~110KB/s 时必炸（`UND_ERR_HEADERS_TIMEOUT` / `ECONNRESET`）。`server/upyun.mjs` 的 `putRaw()` 已改用 `node:https` 不限时（一次上传约 15 分钟，属正常）。别改回 `fetch`，也别因为「传得慢」就以为脚本卡死。

## 5. 代码地图（改之前先定位）

| 想改什么 | 去哪里 |
|---|---|
| 窗口/穿透/托盘/自启 | `src/main/main.js`（`placeWindow()`、32ms 指针轮询、`islandRect`） |
| 数据结构/迁移 | `src/main/store.js`（DEFAULTS、`migrate()`） |
| 渲染层交互 | `src/renderer/app.js`（`S` = 全局状态，`setMode/setTab/render*`） |
| 样式/主题 | `src/renderer/styles.css`（`--ink/--accent/--surface-*`，扁平化覆盖段在文件末尾） |
| 小纸条协议 | `server/index.mjs` + `app.js` 的 `chat*` 系列 |
| 账号/设备 | `server/index.mjs` 的「账号体系」段 + `src/main/account.js` |
| 官网/开发记录 | `site/index.html`、`site/changelog.html`、`site/assets/site.*` |
| 发版 | `deploy/publish.ps1`（会推服务器 + 又拍云 + 官网，并打印三处版本校验） |

状态机：`HEIGHTS` 定义各形态高度（idle 34 / compact 58 / panel 448 / peek 66 / drop 86 / sel 104 / palette 344 / warn 168），`setMode(m, force)` 写 `#stage` 的 `--isl-w/--isl-h/--isl-r`，`data-state` 驱动 CSS。

## 6. 服务端

- 生产：`root@81.70.254.230`（腾讯云），systemd `island-notebook.service`，目录 `/www/wwwroot/island/{app,data,logs}`，端口 3311，nginx 反代 `https://chat.ccyyqq.com/island/`。
- 部署：`deploy\deploy.ps1`（scp + 远端 `install.sh`，幂等）。
- 数据库：`/www/wwwroot/island/data/island.db`（SQLite）。**改表前把 `island.db*` 复制到 `/root/island-bak/`**。
- 已上线接口见 `server/index.mjs` 路由表；账号接口文档见 `docs/qing-account-plan.md` §6。

## 7. 发版流程（客户端）

1. bump `package.json` 的 `version`（**定点替换**，别 `replaceAll('1.10.9','1.10.10')`，会把历史条目改成新版号）。
2. 更新 `site/changelog.html`：追加 `cl-item`（按时间正序，最新在最下）+ 首屏天数/版本数 + `<title>`/description + 页脚版本 + 下载直链。
3. 更新 `CHANGELOG.md`（纯文本版）与 `README.md` 的版本串。
4. `npx electron-builder --win` → 静默装机 → 装机版自测（CDP 9223）。
5. `deploy\publish.ps1 -Version x.y.z -Notes "..."` → 三处必须是 OK（CDN 偶发 MISMATCH 属已知缓存）。
6. `node -e "fetch(...)"` 抓线上 changelog 确认新条目在。
7. 以**无调试端口**重启常驻。
8. 写 `HANDOFF.md`。

## 8. 变更交接协议（**每个 Agent 都必须遵守**）

> 目的：用户会在 Codex / Claude Code / Kimi / z-code / DeepSeekRuntime 之间轮换干活。任何 Agent 接手时只读 `AGENTS.md` + `HANDOFF.md` 就应该能无缝继续。

**每次完成一批改动（或中途暂停交班）后，立刻在 `HANDOFF.md` 顶部追加一条**，格式固定：

```markdown
## 2026-11-13 10:50 · 1.10.11 · DeepSeekRuntime
- 改了什么：一句话 + 涉及文件（路径:行号更好）
- 为什么：需求/根因
- 怎么验证：命令或操作步骤 + 实测结果
- 下一步 / 已知问题：没做完的、坑
```

规则：
- **只追加，不改历史**（需要更正就在新条目里说明）。
- 时间用本地时间（Asia/Shanghai），版本号写当前 `package.json` 的版本。
- 涉及发版时写清三处校验结果（服务器 / 官网 / CDN）。
- 重大决策写进 `docs/`，`HANDOFF.md` 只留摘要 + 链接。
- 若改动会破坏旧数据/接口，必须在条目里用 **⚠️ 破坏性变更** 标注并写迁移方式。

## 9. 当前进度（会随里程碑更新）

- 客户端：**1.11.0**（账号 M2 已落地：设置页账号区、登录/注册/恢复码、设备列表与移除、退出/注销；登录态 DPAPI 加密、重启自动恢复）。
- 账号化：M1 服务端 ✅（`/api/auth/*`、`/api/me`、设备撤销）；M2 客户端账号 ✅（2026-11-13）。方案与接口见 `docs/qing-account-plan.md` §6。
- 本地数据仍是单 `state.json`（本地模式）；`local\` 与 `accounts\<uid>\` 分区与「归属」卡片留到 M3 一起做。
- 未做：M3 归属流程 + 数据分区、M4 Qing 事项、M5 频道跟账号、M6 分享/绑定（含「发送 Qing 事项给 xxx」，接收方仅 Windows）、M7 增量同步。
