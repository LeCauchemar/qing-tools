# Copilot instructions

本仓库的完整约定见 [`AGENTS.md`](../AGENTS.md)（目录结构、硬性约束、代码地图、发版流程）。动手前请先读。

三个高频坑：

1. 不要用 PowerShell 读写文本文件（`Get-Content | Set-Content` 会按 GBK 毁掉 UTF-8 中文）。
2. 启动 Electron 前 `Remove-Item Env:ELECTRON_RUN_AS_NODE`。
3. 清理测试数据只删自己刚创建的（按前缀/时间过滤），不要整表循环删除。

改完代码请在 [`HANDOFF.md`](../HANDOFF.md) 顶部追加一条交接记录（改了什麼 / 为什么 / 怎么验证 / 下一步）。
