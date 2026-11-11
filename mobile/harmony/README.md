# 鸿蒙（HarmonyOS NEXT / ArkTS）短信验证码 → 桌面灵犀岛

> 目标：鸿蒙手机上收到验证码，桌面的 Qing Tools 立刻弹条并复制。
> 环境：DevEco Studio 5.0+、HarmonyOS NEXT（API 12 及以上）、真机调试。

源码压缩包（约 13 KB，就是本目录这些文件）：
<https://qing.ccyyqq.com/island/update/QingToolsSMS-harmony.zip>
备用：<https://qingtools.ccyyqq.com/download/QingToolsSMS-harmony.zip>

## 零、先说清楚鸿蒙的限制（很重要）

鸿蒙 NEXT 和 iOS 一样，**短信内容不是随便能读的**：

| 能力 | 权限 | 谁能用 |
|---|---|---|
| 直接读短信数据库（`@ohos.telephony.sms`） | `ohos.permission.RECEIVE_SMS` / `READ_SMS` | **系统应用 / 受限权限（ACL）**，普通应用拿不到 |
| 订阅通知、读通知正文 | `ohos.permission.NOTIFICATION_CONTROLLER` | **受限权限（ACL）**，需要在 AppGallery Connect 申请 |
| 读剪贴板 | 无（`@ohos.pasteboard`，前台可读） | 所有应用 |

所以这里给两条路：

- **路线 A（推荐，零受限权限，一定能用）**：复制验证码 → 点一下（桌面图标 / 服务卡片 / 通知栏）→ 自动转发。和 iPhone 快捷指令是一个思路。
- **路线 B（全自动，但要 ACL）**：订阅通知，命中「短信」包名 + 验证码关键词就自动转发；没有 ACL 的话 `subscribe` 会抛 201（权限不足）。

两条路都复用同一个服务端接口，密钥就是桌面「设置 → 短信验证码 → 手机密钥」里建的那把。

---

## 一、建工程

1. DevEco Studio → **File → New → Create Project** → 选 **Empty Ability**（Stage 模型）→
   - Project name: `QingToolsSms`
   - Bundle name: `com.qingtools.sms`
   - Compatible SDK: **API 12**（HarmonyOS NEXT）
   - Device type: Phone
2. 把本目录的这些文件覆盖进工程（结构一一对应）：
   ```
   entry/src/main/module.json5                        ← 权限 + 入口
   entry/src/main/ets/entryability/EntryAbility.ets   ← 启动时加载配置
   entry/src/main/ets/pages/Index.ets                 ← 配置界面 + 一键发送
   entry/src/main/ets/common/Config.ets               ← 地址/密钥存取 + 验证码抽取（squeeze/extractCode/parseConfig）
   entry/src/main/ets/common/Forward.ets              ← HTTP 发送
   entry/src/main/ets/notif/SmsWatcher.ets            ← 路线 B：通知订阅
   ```
3. `module.json5` 里的 `requestPermissions` 已经写好 `ohos.permission.INTERNET`（必须），
   `ohos.permission.NOTIFICATION_CONTROLLER` 默认注释掉 —— **没有 ACL 就别打开**，否则装上就崩。

## 二、签名与安装

1. DevEco Studio → **File → Project Structure → Signing Configs** → 勾 **Automatically generate signature**（需要登录华为账号）。
2. 手机开 **开发者模式 + USB 调试**，连上电脑，点 ▶ Run。
3. 若只想装到自己的手机，debug 签名就够了；要上架或长期用，走正式签名。

## 三、路线 A：剪贴板一键转发（推荐）

### 用法

1. 手机收到验证码 → 点键盘上方/短信里的「复制验证码」（或长按短信复制）。
2. 回到桌面点 **Qing Tools 短信** 图标（或把它加到桌面/侧边栏）→ 点 **「发送剪贴板」**。

桌面立刻弹「验证码 123456 · 10086 · 已复制」。

### 更快的触发方式（任选其一）

- **服务卡片**：长按应用图标 → 服务卡片 → 把「一键转发」卡片拖到桌面，点卡片即发。
  （代码里 `pages/Index.ets` 的 `sendClipboard()` 已经抽成独立方法，做卡片时直接调用同一份 `Forward.send()`。）
- **通知栏常驻入口**：应用里可以发一条本地通知（`notificationManager.publish`），点它唤起应用再点发送。
  注意：鸿蒙不允许第三方应用把通知做成常驻不可清除，所以这条路只是"少两步"，不是全自动。

### 第一次配置

1. 电脑上：Qing Tools → 设置 → 短信验证码 → 手机密钥 → 输入 `HarmonyOS` → **新建密钥** → 配置自动进剪贴板。
2. 把这段文字发到手机（微信/QQ 文件传输助手都行）→ 手机上打开 Qing Tools 短信 → **从剪贴板粘贴配置** → **保存**。
3. 点 **发送一条测试**，桌面应该马上弹「验证码 123456」。

## 四、路线 B：通知订阅（全自动，需要 ACL）

### 申请受限权限

1. AppGallery Connect → 你的应用 → **开发 → 权限管理** → 申请 `ohos.permission.NOTIFICATION_CONTROLLER`（说明用途：把用户本人收到的短信验证码转发到用户自己的电脑）。
2. 审核通过后，在 DevEco 的 **Project Structure → Signing Configs → 手动签名**里带上该权限的 ACL（`acls` 字段），或在 AGC 下发的 profile 里已包含。
3. 没有 ACL 时 `notificationManager.subscribe()` 会失败（错误码 201 权限不足）——应用会退化成路线 A，不会崩。

### 打开开关

`pages/Index.ets` 里「自动监听通知」开关 → 打开 → `SmsWatcher.start()`。

它会：

1. 订阅所有通知；
2. 只放行 `bundle` 含 `mms` / `sms` 的通知（鸿蒙短信应用包名 `com.ohos.mms`）；
3. 用和安卓端同一套关键词正则抽验证码；
4. 命中就 `Forward.send()`，桌面弹条。

### 已知限制

- 短信应用如果关闭了通知，或者把验证码短信归到「验证码」分组且不弹通知，订阅也拿不到 —— 这时退回路线 A。
- 鸿蒙的「纯净模式」会拦截非应用市场安装包，装之前要在设置里允许「外部来源应用」。

## 五、服务器接口（和安卓/iOS 完全一致）

```text
POST https://chat.ccyyqq.com/island/api/hook/sms?token=<手机密钥>
Content-Type: application/json; charset=utf-8

{"from":"10086","text":"您的验证码是 123456，5 分钟内有效","src":"harmony"}
```

也支持 GET（给快捷指令/浏览器用）：

```text
GET https://chat.ccyyqq.com/island/api/hook/sms?token=<手机密钥>&text=<URL 编码后的短信内容>
```

返回：`{"ok":true,"id":"...","code":"123456","device":"HarmonyOS"}`

- 密钥是「每台手机一把」，在桌面端「手机密钥」里建、可随时撤销；
- 同一设备每分钟最多 20 条，超了返回 429；
- 推送只会送到**建这把密钥的那台电脑**（多租户隔离）。

## 六、打包发布（可选）

```powershell
# 生成 HAP（debug）
hvigorw assembleHap --mode module -p product=default -p buildMode=debug
# 产物：entry/build/default/outputs/default/entry-default-signed.hap
```

装到手机：

```powershell
hdc install entry\build\default\outputs\default\entry-default-signed.hap
```

## 七、排查

| 现象 | 原因 | 处理 |
|---|---|---|
| 点「发送剪贴板」提示「剪贴板是空的」 | 鸿蒙前台读剪贴板，复制完要**先回到应用**再点 | 先复制，再切到应用 |
| 测试能通、真短信不来 | 走的是路线 A，需要手动点一下 | 打开路线 B（ACL）或养成「复制→点一下」的习惯 |
| `subscribe` 报 201 | 没有 `NOTIFICATION_CONTROLLER` 的 ACL | 先在 AGC 申请，或改用路线 A |
| 桌面不弹 | 手机密钥对应的是别的电脑，或被撤销 | 桌面端「手机密钥」里看设备状态，重建一把 |
