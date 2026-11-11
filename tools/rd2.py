import io
p = r'README.md'
s = io.open(p, encoding='utf-8').read()
pairs = [
 ("| **邮件推送** | IMAP IDLE 长连接，新邮件秒级主动推送（不再干等定时拉取）；断线自动退避重连，推送不可用时自动降级成定时检查 |",
  "| **邮件推送** | **可同时登录多个邮箱**（QQ / 163 / 126 / Gmail / Outlook / 阿里云 / 自定义）：每个账户各自保持 IMAP IDLE 长连接，新邮件秒级主动推送；邮件页顶部有账户筛选条（「全部」或只看某一个，带未读计数）；断线自动退避重连，推送不可用时自动降级成定时检查 |"),
 ("| **主题** | 深色 / 浅色两套基调，主题色可选（紫 / 蓝 / 绿 / 橙 / 粉…）或自己调任意颜色 |",
  "| **主题** | 深色 / 浅色两套基调，主题色可选（紫 / 蓝 / 绿 / 橙 / 粉…）或自己调任意颜色；整体**扁平化**：纯色底 + 细描边，没有高光、内阴影、发光与毛玻璃 |"),
]
for a, b in pairs:
    if a not in s:
        print('MISS ' + a[:36]); continue
    s = s.replace(a, b)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('done')
