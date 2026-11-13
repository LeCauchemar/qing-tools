# CLAUDE.md

本仓库的完整协作约定在 **[`AGENTS.md`](AGENTS.md)** —— 动手前请先完整读一遍（目录结构、10 条硬性约束、代码地图、发版流程）。

## 三条最容易踩的

1. **不要用 PowerShell 读改写文本文件**（`Get-Content | Set-Content` 会按 GBK 毁掉 UTF-8 中文）。用编辑器工具或 Node 的 `fs.readFileSync(p,'utf8')` + `writeFileSync`。
2. **启动 Electron 前 `Remove-Item Env:ELECTRON_RUN_AS_NODE`**，否则装好的 exe 会「一闪就退、日志为空」。
3. **清理测试数据只删自己刚创建的**（按文本前缀/时间过滤），历史上整表循环删除删光过用户真实备忘录。

## 交接（强制）

改完任何东西，在 **[`HANDOFF.md`](HANDOFF.md)** 顶部追加一条：

```markdown
## 2026-11-13 10:55 · 1.10.11 · Claude Code
- 改了什么：…
- 为什么：…
- 怎么验证：…
- 下一步 / 已知问题：…
```

用户会在多个 Agent 之间连续作业，这份日志是唯一的接力棒。
