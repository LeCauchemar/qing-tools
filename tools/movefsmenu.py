import io, re
p = r'src/renderer/index.html'
s = io.open(p, encoding='utf-8').read()
block = """              <div class="fs-menu hidden" id="fsMenu">
                <button class="fs-item" data-fs-act="stash"><svg class="ic"><use href="#i-files" /></svg>发送到文件区</button>
                <button class="fs-item" data-fs-act="all"><svg class="ic"><use href="#i-check" /></svg>全选</button>
                <button class="fs-item" data-fs-act="none"><svg class="ic"><use href="#i-x" /></svg>取消选择</button>
              </div>
"""
if block not in s:
    raise SystemExit('block not found')
s = s.replace(block, '')
# 插到 #msgMenu 之后（和 toast 同级，避免被 .island 的 transform 影响 fixed 定位）
anchor = '<div class="msg-menu hidden" id="msgMenu">'
i = s.find(anchor)
if i < 0:
    raise SystemExit('anchor not found')
end = s.find('</div>', s.find('</div>', s.find('</div>', i) + 6) + 6)  # 找到 msgMenu 的结束标签
# 稳妥起见：定位到 msgMenu 结束（三级嵌套），用更简单的方法：找 '</div>\n' 序列
j = s.find('id="msgMenu"')
k = s.find('</div>', s.find('</div>', s.find('</div>', j) + 6) + 6) + 6
s = s[:k] + '\n' + block.replace('              ', '      ') + s[k:]
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('moved')
