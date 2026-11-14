# Qing Tools 阶段性细节存档（1.10.5 → 1.12.1）

> 这些是 2026-11 那段时间逐版本记下来的细节，已经从根 `AGENTS.md` 挪到这里（根文件有 64KB 注入预算，超了会被截断）。
> 需要查具体某个版本的实现细节时再来这里；日常先看根文件的「铁律」和近两版记录。

## 1.10.5 粘贴归属（备忘录）
- 判断「粘到哪」要看「这次是在哪个框里按的」：e.target === el.noteInput && el.noteInput.value.trim() 成立就合成同一条；否则才退回正在编辑 / 展开的那条。只看「有没有打开编辑框」会把新建框里写的字和图拆成两条。
- closeEditMenu() 会清空 S.editTarget，菜单里的粘贴动作要先存目标再关菜单。
- composeNoteWithImage(file, text) 是 Ctrl+V 与右键「粘贴图片」共用入口，新增粘贴路径一律走它。

## 1.10.6 通知条进度线
- .peek-bar 曾是 left/right:0; bottom:0; height:2px，锚在岛矩形上、不跟圆角裁切，看起来像一条浮在药丸下沿外的细线。现在是 left/right:18px; bottom:7px; height:3px; border-radius:2px + 主题色混深色，完全在药丸内部。通知条高度 66px 时不要再把它贴底边。

## 1.10.7 便条看大图 / 拖动 / 缩放
- 便条里的图片点击 → 独立「看大图」窗口（`src\renderer\viewer.html` + `viewer.js/css` + `src\main\viewer-preload.js`），主进程 `openViewer()` 创建：transparent + frameless + alwaysOnTop floating + 1180×880 上限；渲染层负责滚轮以光标为中心缩放（8%–800%）、拖动平移、双击还原，Esc/✕ 走 IPC `viewer:close`。
- 桌面便条窗口是**透明无边框**的，Windows 上**没有系统缩放边框**（`resizable: true` 也没用）——缩放改由渲染层三条把手 `.rz-r/.rz-b/.rz-br` 实现：`pointerdown` 记 `screenX/screenY` 与 `innerWidth/innerHeight`，`pointermove` 用 rAF 合并后 `sticky.resize(w,h)` → 主进程 `ipcMain.on('sticky:resize')` 里 `win.setSize()`；尺寸仍由 `resized/resize` 事件写回 `note.w/h`。
- 拖动：`.paper` 设 `-webkit-app-region: drag`，`.note`/`.tools`/`.foot`/`.rz` 必须显式 `no-drag`，否则正文点不进去；以前只有顶部 `.grip`（还被胶带压住）能拖。
- 图片点击要吞掉 `mousedown`（捕获阶段 `preventDefault`），否则 contenteditable 会先把光标挪到图前面。
- `tools/cdp.mjs` 改用 `/json/list`：第二个及以后的 BrowserWindow（看大图窗口）有时不出现在 `/json` 里，`/json/list` 才全。
- 测试便条时给 `api.notes.add()` 传**字符串**，传对象会存成 `[object Object]`；便条窗口的 `sticky:update` 在 `document.activeElement === note` 时会主动跳过（防覆盖正在输入），CDP 里要先 `blur()` 再推文本。

## `m.testH5.ccyyqq.com`：阿里云人脸活体验证 H5 测试（2026-11-10 上线）
- 源码 `face-liveness-h5\`（`public\` 静态页 + `server\server.mjs` 后端 + `deploy\` 脚本 + `tools\` 自检），线上 <https://m.testH5.ccyyqq.com/>。
- 服务器布局：站点根 `/www/wwwroot/m.testH5.ccyyqq.com/` 放静态页（nginx 直接发），后端 `_app/server.mjs`，数据 `_data/{config.json,admin.token,api.log}`（750/600，属主 www）。`/api/` 反代到 `127.0.0.1:3121`（`face-liveness.service`，`User=www`，`Restart=always`），`/_app/`、`/_data/` 在 vhost 里 return 404。
- nginx 改动只许改 vhost 里 `# FACE-LIVENESS-START/END` 标记块（由 `deploy\remote-install.sh` 幂等维护，插入点紧跟 `server_name`）；改前脚本会备份到 `/root/face-liveness-nginx-backup-<ts>/`。
- 部署：`powershell -NoProfile -File deploy\deploy.ps1`（scp 静态页+后端 → 远端装 systemd/nginx → 线上自检）。PowerShell 5.1 无 BOM 读 .ps1 按 ANSI，**脚本里的中文 Write-Host 会变乱码**，所以 deploy.ps1 的消息一律 ASCII。
- 后端零 npm 依赖，自己实现云认证 RPC 签名（HMAC-SHA1，`POST&%2F&percentEncode(sortedQuery)`，key=`AccessKeySecret + "&"`）；AccessKey 只在服务器 `_data/config.json`，浏览器拿不到；写配置要 `X-Admin-Token`（`_data/admin.token`，当前 `b9679c747c589309f13b2f3615e6ac1c`）。
- 两种模式：`mock`（默认，跳本站 `/mock.html` 模拟刷脸，能完整走通 初始化→跳转→回跳→Describe→记录）与 `live`（真调 InitFaceVerify，需要 AK + SceneId；RAM 用户要有 `AliyunAntCloudAuthFullAccess`）。MetaInfo 必须由前端 `window.getMetaInfo()` 实时取（jsvm_all.js），写死拿不到 CertifyUrl。
- 自检：`node tools/selftest.mjs`（本地 24 项）、`node tools/online-check.mjs`（线上 17 项）、`node tools/e2e.mjs`（真浏览器点全流程）、`node tools/shot.mjs <url> 390 844 out.png 2 1`（CDP 移动视口截图；`CAPTURE_VIEWPORT=1` 只截视口，`PRE_JS=...` 截图前执行 JS）。
- 坑：`chrome --headless=new --window-size=390,...` 在 Windows 上不会真缩视口，必须用 CDP `Emulation.setDeviceMetricsOverride`；`captureBeyondViewport:true` 会让 sticky 顶栏在长图里重复出现（截图假象）。
- 抽屉 `.sheet` 是 flex 列（`.sheet-head` + 可滚 `.sheet-body` + 固定 `.sheet-actions`），**不要再用 sticky 按钮**，否则会盖住表单字段。


## 1.10.8 下载走 CDN（客户端 + 官网）
- 安装包下载顺序：`CDN_UPDATE`（https://qing.ccyyqq.com/island/update）→ 清单来源 `base` → `SERVER_UPDATE`（https://chat.ccyyqq.com/island/update）。`downloadSources(file, base)` 生成候选，`fetchToFile()` 每次下完都校验 sha256，失败就换下一个；别把顺序改回「服务器优先」，那是 100 MB 走自己带宽。
- **更新清单仍旧服务器优先**（`UPDATE_BASES()` 不动）：又拍云对 `latest.json` 会缓存好几天，改顺序会让「检查更新」看到旧版本。
- 官网：`site.js` 的 `applyDownloadLinks(file)` 会先 `cdnReachable()`（fetch CDN `latest.json`，4 秒超时），探不通就把 `.js-dl`/`.js-dl-portable`/`.js-mirror` 对调，并给 `#dlMirror` 加 `.fallback`、改 `#dlMirrorText` 文案。改完记得把 `site.js?v=` / `site.css?v=` 各加一。


## 1.10.9 提醒事项 + 倒数日 + 随机面板
- **两张新卡**：小工具页从 7 张涨到 9 张。reminders / countdowns 加在 store.data 顶层，默认值在 store.js DEFAULTS。
- **提醒**：主进程每 2 秒 tick 一次，r.at <= now 且未 done 未 fired 就 send('reminder:fire') 并标 firedAt。纪念日每天首次启动检查一遍（_lastAnnCheck）。渲染层 onReminderFire = shakeIsland + 边缘彩虹（rim-rainbow class）+ showPeek。
- **边缘彩虹 CSS**：用 mask-composite: exclude 只留边框（::after inset:-3px padding:3px），内容区不铺色。和 @ 时的整片彩虹（.rainbow）是两套。
- **倒数日**：发薪日 payday（1-31，0=未设置），anniversaries[] 每年/一次性。nextChineseHoliday() 用现有 festivalOf() 扫未来 400 天，挑下一个法定节假日。
- **随机面板**：开发小工具第 6 个 tab（rand），coin/dice/range/pick 四个动作，抽签读输入框每行一个选项。

## 1.10.10 主题对比度 + 真·跑马灯
- 次要文字统一用 `color-mix(in srgb, var(--ink) N%, transparent)`，不要再写 `--muted`/`--dim` 的写死 hex：`.row-sub` 68%、`.row .time` 58%、`.tc-sum` 66%、`.cd-label` 66%、`.cd-badge` 80% 文字 + 10% 底。写死色在深浅两套主题下对比度会岔开（深色偏灰、浅色偏淡），用户直接反馈可读性差。
- 边缘彩虹必须画在 `.island` **内侧**（`inset: 0`）：`.island` 是 `overflow: hidden`，画到外侧（`inset: -3px`）会被裁掉，只剩顶边一条直线（1.10.9 的 bug）。
- 跑马灯用 `conic-gradient(from var(--rim-a))` + `@property --rim-a { syntax: "<angle>" }` + `@keyframes rimSpin { to { --rim-a: 360deg } }`，1.9s 一圈；`linear-gradient` 只能做流光、不能沿边跑。加了 `prefers-reduced-motion` 兜底。

## 1.10.11 原生控件 color-scheme
- 页面从没声明过 `color-scheme`：Chromium 对 `datetime-local`/`time`/`select`/滚动条一律按**浅色 scheme** 画内部，深色面板上就成了黑字黑底（用户截图「年月日看不见」）。已在 `styles.css` 提醒段加 `html[data-theme="dark"]{color-scheme:dark}` / `html[data-theme="light"]{color-scheme:light}`，以后加原生控件不用再单独调色。
- `.rem-when input[type="datetime-local"]` 统一 26px 高 + `color: var(--ink)` + `font-variant-numeric: tabular-nums`；`::-webkit-calendar-picker-indicator` 默认 55% 不透明度、hover 92%，聚焦加强调色描边。
- 提醒卡下面那段「到点会像拍一拍那样抖一下…」的提示已整块删除（`#remEmpty` 元素一起去掉，`renderReminders()` 里本来就 `if (el.remEmpty)` 保护），别再补回来。
- **标题栏补充信息**：`index.html` 的 `.brand` 里 `#clock` 后面是 `#headExtra`；`.brand{flex:1;padding-right:8px}` + `.brand-extra{flex:1 1 auto;min-width:0;11.5px;58% ink;省略号}`。文案由 `renderHeadExtra()`（app.js，紧跟 `renderIdleSub()`）拼「M月D日 周X · 农历/节日 · 温度 天气」，由 `renderIdleSub()` 末尾调用 —— 天气/农历变了会自动同步，不要另开定时器。
- **字号档位（1.10.11 起）**：`.peek-top span` 12.5px/500/62% ink/右对齐；小纸条 `.msg .who` 11px、`.msg .bub` 14.5px（padding 8/11、line-height 1.5）、`.msg .time` 10.5px、`.msg.sys .bub` 12.5px。次要文字一律 `color-mix(in srgb, var(--ink) N%, transparent)`，不要用写死的 `--dim`/`--muted`（深浅主题强度对不齐）。

## 账号体系 M1（服务端，2026-11-12）
- 新表全部 `CREATE TABLE IF NOT EXISTS`（users / sessions / bindings / shares / items / changes），纯增量，没动 rooms/devices/messages 的老结构；生产库改前先 `cp` 到 `/root/island-bak/`。
- 密码与恢复码都用 `node:crypto` 的 `scrypt`（N=2^15, r=8, p=1, maxmem=128MB），**不引原生依赖**（argon2 会让 electron-builder 重编译）。
- **坑**：恢复码必须用「密码的 salt」存 hash（`scryptHash(normRecovery(code), pw.salt)`）。第一版用了独立 salt 却没存，导致找回永远 `bad_recovery`，自测脚本一眼看出来。
- 会话用不透明 token（32B base64url），库里只存 `sha256(token)`，90 天滚动；`requireUser()` 同时认 `Authorization: Bearer` 与 `X-Island-Session`（cors 已放行这两个头 + DELETE）。
- 限流在内存滑窗：注册 10/h/IP、登录 20/h/IP、找回 10/h/IP；同用户名连错 5 次锁 15 分钟（`loginLocks`）。
- 注销不删用户行：`tombstoneUser` 清空凭据 + 写 `deleted_at`（**用户名永不释放**），items/shares/bindings/changes/sessions 物理删。
- 自测：`BASE=https://chat.ccyyqq.com/island node tools\test-auth.mjs`（20 项，注册/重复/登录/锁/找回/踢设备/登出全部/注销/用户名保留）。
- 部署：`deploy\deploy.ps1` → scp `server\` 到 `/www/wwwroot/island/app` → 跑 `install.sh` 重启 3311；远端 sqlite 改动用「本地写 .sql → scp → `sqlite3 island.db < file.sql`」，不要在 ssh 参数里塞引号（会被 PowerShell/ssh 双层吃掉）。

## 1.12.0 · M3/M4/M5（账号归属、Qing 事项、频道跟账号）

- 本机数据与账号数据分区：`DATA_DIR\state.json`（local）与 `DATA_DIR\accounts\<uid>\state.json`（account），`store.use(file)` 在登录/退出时切换；`QT_DATA_DIR` 环境变量可把整个数据目录指向临时目录做测试。
- 归属卡片：`api.account.claimInfo()` 数本机条数，`claim()` 用 `mergeById` 并进账号分区，写完给本机 `meta.claimedBy` 打标（只认领一次）。先给人「导出备份」（`app:exportBackup` 落到文档目录）再认领。
- Qing 事项：`notes:add(text, kind)` 的 `kind = note|todo`，`notes:done` 切换完成；老 `todos` 由 `migrateQingItems()` 一次性并进 notes；待办新建自动 `togglePin`；`pinned` 的删除按钮一律置灰。
- 频道归属：服务端 `rooms.owner_user_id` + `POST /api/rooms/claim`（先到先得，被认领过 409 `taken`）+ `GET /api/me/rooms`；客户端 `claimLocalRooms()` 登录后认领、`syncAccountRooms()` 用 `replace: true` 重新 join 回来（不替换会因同名设备失败）。
- 匹配码大小写敏感：认领/查询只去空白，**绝不要 toUpperCase**。

---

## 1.12.1 归属搬图片
- `account:claim` 除了并 notes/todos/reminders/anniversaries，还要扫 `[[img:<file>]]` 与 `note.image`，把 `DATA_DIR\note-images` 里缺的文件复制到 `noteImagesDir()`（账号分区），否则账号里图片全是裂图（1.12.0 的 bug）。
- 复制前做 `/^[A-Za-z0-9._-]+$/` 白名单校验，目标已存在就跳过；`copied.images` 记数量。
- 已经归属过的机器：直接把 `%APPDATA%\DynamicIsland\note-images\*` 复制到 `accounts\<uid>\note-images\` 即可修复历史数据。

---
