# Qing Tools 账号化改造 · 设计与实施计划

> 状态：**方案待审**（本文档不含任何代码改动）
> 版本基线：1.10.11
> 决策依据：用户 2026-11-12 的答复（A/B/C/D 全部条目 + 手机端暂缓）

---

## 0. 结论与范围

- 目标：把「跟着设备走」改成「跟着账号走」，同时把备忘录与待办合并为 **Qing事项**，并支持把事项**复制一份**分享给已绑定的好友。
- **本期不做**：安卓 / iOS App、桌面小组件、第三方推送（数据结构预留，接口预留位）。
- 保留：未登录的**本地模式**（记事、剪贴板、频道码聊天全部可用）。

交付分 7 个里程碑（见 §9），预计 24 个工作日。

### 进度

| 里程碑 | 状态 |
| --- | --- |
| M1 账号后端 | ✅ **已完成并上线**（2026-11-12，接口见 §6，自测 20/20 通过） |
| M2 客户端账号 | ✅ **已完成**（2026-11-13：设置页账号区、设备列表、找回、注销） |
| M3 归属流程 | 待开始 |
| M4 Qing事项 | 待开始 |
| M5 频道跟账号 | 待开始 |
| M6 分享 + 绑定 | 待开始 |
| M7 同步协议 | 待开始 |

M1 已上线的接口：`/api/auth/check`、`/api/auth/register`、`/api/auth/login`、`/api/auth/recover`、`/api/auth/logout`、`/api/auth/logout-all`、`/api/me`（GET/DELETE）、`/api/me/sessions/:id`（DELETE）。线上库已建表：`users / sessions / bindings / shares / items / changes`（后四张为后续里程碑预留，暂未开放写接口）。自测脚本：`tools\test-auth.mjs`（`BASE=https://chat.ccyyqq.com/island node tools\test-auth.mjs`）。

---

## 1. 身份与安全

### 1.1 用户名
- 3–20 位，`[A-Za-z0-9_]`；唯一性按小写比较（`Qing` 与 `qing` 视为同一个），显示保留注册时的原样。
- 昵称（群里显示名）与用户名分离，可随时改，不唯一。
- **用户名不释放**：注销后永久占用。

### 1.2 密码
- 最少 8 位；服务端用 Node 内置 `crypto.scrypt`（N=2^15, r=8, p=1，salt 16B，输出 32B）——**不引入原生依赖**，避免 electron-builder 重构原生模块。
- 存 `password_hash` + `password_salt` + `password_algo`（留升级位）。

### 1.3 恢复码
- 注册时生成 `XXXX-XXXX-XXXX`（Crockford Base32，去掉易混字符），**只显示一次**。
- 服务端只存 `recovery_hash`（同样 scrypt），不能反查。
- 用恢复码重置密码成功后：**旧恢复码立即作废，生成并展示新恢复码**，要求用户再次确认保存。
- 注册页强提示：大字 + 复制按钮 + 下载 `恢复码.txt` + 勾选「我已保存」，不勾不能继续。

### 1.4 会话（长期登录态）
- 采用**不透明 token**（32B 随机，DB 存 SHA-256），不用 JWT：易撤销、易做设备列表。
- 有效期 90 天滚动续期（每次请求刷新 `last_seen`，超过 60 天未活跃则要求重新登录）。
- 客户端用 `safeStorage.encryptString` 加密后存 `%APPDATA%\DynamicIsland\auth.bin`。
- 多端并存；`sessions` 一行 = 一台设备，可单独踢掉，也可「退出所有设备」。

### 1.5 限流
- 同一用户名连续失败 5 次 → 锁 15 分钟。
- 同一 IP 每小时 20 次登录/注册/找回尝试。
- 找回密码同样限流（防恢复码爆破：12 位 Base32 ≈ 60 bit，配限流足够）。

### 1.6 注销
- 三重确认：输入用户名 + 密码 + 恢复码；文案写明「立即永久删除，不可恢复」。
- 提供「先导出我的数据（JSON）」按钮。
- 删除范围：账号、会话、绑定、分享、事项、频道成员关系、消息、云端图片（逐个删除又拍云 key）。
- 频道处置：若该用户是频道创建者 → 移交给**最早加入的其他成员**；无其他成员则解散。

---

## 2. 数据模型（SQLite）

现有 `server/index.mjs` 里已有 `rooms / devices / messages / stickers / votes / sms_*`。新增与改动如下（示意 DDL）：

```sql
-- 账号
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL,
  username_lc   TEXT NOT NULL UNIQUE,
  nick          TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  deleted_at    INTEGER
);

-- 登录会话（一台设备一行）
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  device_name TEXT NOT NULL DEFAULT '',
  ua          TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  revoked_at  INTEGER
);

-- 绑定（双向确认，最多 3 个）
CREATE TABLE bindings (
  id         TEXT PRIMARY KEY,
  from_user  TEXT NOT NULL,
  to_user    TEXT NOT NULL,
  status     TEXT NOT NULL,      -- pending | accepted | rejected | removed
  created_at INTEGER NOT NULL,
  acted_at   INTEGER,
  UNIQUE(from_user, to_user)
);

-- 统一事项（备忘录 + 待办）
CREATE TABLE items (
  id         TEXT PRIMARY KEY,
  owner_id   TEXT NOT NULL,
  kind       TEXT NOT NULL,      -- note | todo
  text       TEXT NOT NULL DEFAULT '',
  images     TEXT NOT NULL DEFAULT '[]',   -- ["cloud:note/xxx.png", ...]
  done       INTEGER NOT NULL DEFAULT 0,
  pinned     INTEGER NOT NULL DEFAULT 0,
  sort_at    INTEGER NOT NULL,   -- 排序用（新建/更新时间）
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  origin     TEXT,               -- 分享来源：{"user":"陈宇清","id":"..."} 的 JSON
  deleted_at INTEGER
);
CREATE INDEX idx_items_owner ON items(owner_id, deleted_at, sort_at DESC);

-- 分享（复制一份给对方）
CREATE TABLE shares (
  id          TEXT PRIMARY KEY,
  from_user   TEXT NOT NULL,
  to_user     TEXT NOT NULL,
  source_item TEXT NOT NULL,
  snapshot    TEXT NOT NULL,     -- 发送时的完整内容（text/images/kind）
  new_item_id TEXT,              -- 接收方生成的那一份
  created_at  INTEGER NOT NULL,
  read_at     INTEGER
);

-- 增量同步（多端）
CREATE TABLE changes (
  seq       INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id  TEXT NOT NULL,
  entity    TEXT NOT NULL,   -- item | room | message | binding | sms
  entity_id TEXT NOT NULL,
  op        TEXT NOT NULL,   -- upsert | delete
  at        INTEGER NOT NULL
);
```

### 2.1 房间与消息：双身份并存

关键约束：**未登录的设备仍然能凭频道码聊天**。所以成员与消息都要同时支持「设备身份」和「账号身份」。

```sql
ALTER TABLE rooms   ADD COLUMN owner_user_id TEXT;   -- 归属账号（可为空）
ALTER TABLE rooms   ADD COLUMN claimed_at    INTEGER;

-- room_members：一台设备一行；已登录的设备带 user_id
CREATE TABLE room_members (
  room_id   TEXT NOT NULL,
  device_id TEXT NOT NULL,
  user_id   TEXT,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (room_id, device_id)
);

ALTER TABLE messages ADD COLUMN user_id TEXT;        -- 发送者账号（匿名时为空）
```

- 计票（踢人投票）、@ 名单、拍一拍一律**按 user 归并**：同一账号的 N 台设备算 1 票、1 个人。
- 已读位置按 `(room_id, user_id)` 存一条 `last_read_message_id`；匿名设备仍按 device 存。
- 同一账号多端：@ 提醒推给全部在线端；拍一拍抖动作用到该用户全部端。

### 2.2 表情包归属（回答 B-5）

现在 `stickers` 是 **群组共有**（按 `room_id`），这个语义其实是对的：表情包属于「这个频道」，不属于某个人。

建议：**保持群组维度，不新建表，只加一个 `origin_user_id` 记录是谁先加的**（用于展示「我加的」），频道被账号认领后表情包跟着频道走，不跟人走。以后若需要「个人表情库」，再加 `scope = room | user` 一列即可，现在不动。

---

## 3. 本地数据分区（换账号不串号）

这是最容易出事故的地方。现在所有状态都在 `%APPDATA%\DynamicIsland`（`state.json` + `localStorage`），一旦支持多账号登录，必须分区：

```
%APPDATA%\DynamicIsland\
  local\              # 未登录（本地模式）的数据：现有数据默认留在这里
  accounts\<userId>\  # 每个账号独立的 state.json / 缓存 / 图片索引
  auth.bin            # 当前登录态（加密）
```

- 登录 → 切到 `accounts\<uid>`；退出 → 回到 `local\`。
- 图片：本地生成的在 `note-images\`（local）与 `accounts\<uid>\note-images\`；云端图片走 `cloud:<key>` + 本地缓存。
- 剪贴板永远只在 `local\`（不跟账号，按你的要求）。

---

## 4. 首次登录的「归属」流程

1. 登录成功后，若 `local\` 里有数据（事项/频道/表情/聊天），弹一张卡片：
   「把本机的 N 条备忘录、M 个待办、K 个频道归到这个账号下？」
2. 底部两个按钮：**先导出备份** / **确认归属**（二次确认）。
3. 确认后：立刻把 `local\` 复制到 `accounts\<uid>\`，再改写库里的 owner：
   - items：`owner_id = uid`
   - rooms：`owner_user_id = uid`（**先到先得**；若该频道已在服务器被别人认领，则本机只做「成员」，不争归属）
   - room_members：本机设备补 `user_id`
   - stickers：随频道走
4. 归属只做一次；之后再切到别的账号，本机数据已属于第一个账号，不再提示。
5. 全过程可回滚：归属前自动写一份 `backup-<timestamp>.json` 到「文档\Qing Tools 备份」。

---

## 5. 同步协议（为手机端预留，但本期就要落地）

- 客户端持有 `lastSeq`；`GET /api/sync?since=<lastSeq>` 返回 `changes` 增量 + 对应实体快照。
- 服务端写入时同事务写 `changes`；桌面端用现有 SSE 通道推 `sync` 事件（`{seq}`），客户端收到后拉增量。
- 冲突策略：**last-write-wins**，但被覆盖的一方保留 `conflict` 副本（`items` 插一条 `origin.conflict = true`），界面用淡色标出「另一台设备的版本」。
- 图片：客户端直传又拍云（已有签名服务），库里只存 key，JSON 里不出现 base64。

---

## 6. 接口清单（新增 / 改动）

| 方法 | 路径 | 说明 | 鉴权 |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | 用户名+密码，返回 `{token, recoveryCode}`（恢复码仅此一次） | 否 |
| POST | `/api/auth/login` | 返回 `{token, user}` | 否 |
| POST | `/api/auth/refresh-code` | 用恢复码重置密码，返回新恢复码 | 否（限流） |
| POST | `/api/auth/logout` | 撤销当前会话 | token |
| POST | `/api/auth/logout-all` | 撤销全部会话 | token |
| GET | `/api/me` | `{user, sessions[]}` | token |
| DELETE | `/api/me/sessions/:id` | 踢掉某台设备 | token |
| DELETE | `/api/me` | 注销（需 body 带用户名+密码+恢复码） | token |
| GET | `/api/items?since=` | 事项增量 | token |
| POST | `/api/items` | 新建（kind = note/todo） | token |
| PATCH | `/api/items/:id` | 改文字/图片/done/pinned | token |
| DELETE | `/api/items/:id` | 删除（固定项返回 409，需先取消固定） | token |
| GET | `/api/bindings` | 我的绑定列表 | token |
| POST | `/api/bindings` | 按用户名申请绑定 | token |
| POST | `/api/bindings/:id/accept` \| `/reject` | 对方处理 | token |
| DELETE | `/api/bindings/:id` | 解除绑定 | token |
| POST | `/api/shares` | 把某条事项复制一份给某个绑定用户 | token |
| GET | `/api/shares/inbox` | 我收到的分享（用于「新事项」红点） | token |
| GET | `/api/sync?since=` | 增量同步（含 items/rooms/messages） | token |
| POST | `/api/rooms/:id/claim` | 把匿名频道归到当前账号（先到先得） | token |

兼容：现有 `/api/rooms/*`、`/api/hook/sms`、`/api/sms/*` 全部保留；`sms_owners` 改为指向 `users.id`（未登录时仍可用旧 ownerId 模式）。

---

## 7. Qing事项（备忘录 + 待办合并）

### 7.1 数据
- 统一 `items` 表，`kind` 区分；旧的 `notes`（含 `[[img:...]]`）与 `todos` 迁移：
  - note → `kind='note'`，图片 token 解析成 `images[]`（本地图片先上传云端，或保留 `local:` 前缀）
  - todo → `kind='todo'`，`done` 保留
- 迁移脚本一次性执行，写 `meta.migratedItems = 1`，失败可回滚（先备份 `state.json`）。

### 7.2 界面
- 页签从「备忘录 / 待办」改为 **「Qing事项」** 一个页签。
- 顶部一行 chip：`全部 / 备忘录 / 待办 / 已完成`（记住上次选择）。
- 列表混排：按 `sort_at` 倒序；每行左侧小图标（📝 / ✅）；固定项置顶并有图钉。
- 输入框上方一行分段控件：`备忘录 | 待办`（默认记住上次）；待办行右侧出现 `✅` 复选。
- 固定上限 5 条；**固定项的删除按钮置灰**，hover 提示「先取消固定再删除」。
- 工具页移除「待办」卡（提醒卡保留），空出的位置不放新卡。

### 7.3 待办浮窗
- 新建待办后，屏幕**右上角**出现一个浮窗（不是每条一个）：显示最近 3 条未完成，可拖动、可关闭、可勾选完成。
- 关闭后不再自动弹；再新建时才弹。
- 位置记忆；避开托盘与通知区域（离右边缘 24px、离顶 24px）。
- 复用现有 `sticky` 窗口的那套（透明无边框 + 自定义拖拽/缩放把手），但独立窗口、独立位置。

---

## 8. 分享与绑定

- 绑定：用户名**精确搜索** → 申请 → 对方同意；**最多 3 个**；可解除。
- 分享：事项详情里点「小飞机」→ 选择已绑定的人 → 「咻」动效 → 服务端 `shares` 落库 → 接收方生成**独立副本**（`origin` 记录来源）→ 红点 + 通知。
- 明确告知：**复制一份，互不影响**；对方完成待办你这边看不到状态。
- Windows 端收到时的「心动」特效：岛边缘向外散射光点（Canvas 粒子，600ms，最多 40 个粒子），同时播放一次缩放脉冲；只在收到分享时触发，不打扰聊天消息。

---

## 9. 里程碑

| # | 内容 | 预估 |
| --- | --- | --- |
| M1 | 账号后端：users/sessions/bindings/shares 表、注册登录找回注销、限流、设备列表 | 3d |
| M2 | 客户端账号：登录/注册/恢复码强制保存、设置页账号区（设备列表/退出/注销）、本地数据分区 | 3d |
| M3 | 归属流程 + 备份导出 + 频道认领（先到先得） | 2d |
| M4 | Qing事项：items 表、旧数据迁移、混排 + chip、固定与删除保护、待办浮窗 | 4d |
| M5 | 频道跟账号：room_members 双身份、消息 user_id、投票/@/拍一拍按人归并、已读按用户 | 4d |
| M6 | 分享 + 绑定 + 小飞机动效 + 心动粒子 + 通知（接收方在 Windows 端；手机端暂缓，不影响发送功能） | 4d |
| M7 | 同步协议：changes 表、`/api/sync`、SSE 推送、冲突副本、又拍云直传 | 4d |

合计 **24 个工作日**（含自测；不含手机端）。

---

## 10. 风险与对策

| 风险 | 对策 |
| --- | --- |
| 老数据迁移不可逆 | 迁移前自动备份 `state.json` + `island.db`；迁移幂等；保留 `meta.migratedItems` 可重跑 |
| 多账号串号 | 本地按 `accounts\<uid>` 分区；退出即切回 `local\`；启动时校验 token 与目录一致 |
| 匿名/账号混用导致越权 | 所有房间接口服务端校验 `room_members`（device 或 user 命中其一）；前端不参与鉴权 |
| token 泄露 | 只存 SHA-256；`safeStorage` 落盘；设备列表可单独撤销；90 天滚动 |
| 频道 30 天自动解散 | 保留现有规则；解散前 3 天提醒；分享出去的副本与被移交的消息不受影响 |
| 图片成本 | 单图上限 24MB 不变；单账号总额度（建议 2GB）到 80% 提示；`cloud:` key 与本地缓存分离 |
| 并发写冲突 | LWW + 冲突副本；不做字段级合并（复杂度不值得） |

---

## 11. 仍需你确认的 4 个小问题

1. **表情包**：按 §2.2 保持「群组共有、跟频道走」，只加 `origin_user_id` —— 可以吗？
2. **归属时频道「先到先得」的判定**：以「谁先在自己机器上点确认归属」为准（不是按频道最后活跃时间）—— 确认吗？
3. **注销时你若是频道创建者**：移交给最早加入的其他成员，没有别人就解散 —— 可以吗？
4. **单账号图片总额度**：建议 2GB（到 80% 提示），够用吗？
