import io
p = r'src/renderer/app.js'
s = io.open(p, encoding='utf-8').read()
pairs = [
 ("' 个项目' : '暂无暂存'", "' 个项目' : '暂无文件'"),
 ("还没有暂存文件", "这里还没有文件"),
 ("// 拖入文件：普通文件直接进暂存箱；图片分两区（暂存 / 发小纸条）", "// 拖入文件：普通文件直接进文件区；图片分两区（文件区 / 发小纸条）"),
 ("toast('已存入暂存箱 ' + ((r && r.added) || paths.length) + ' 个项目');", "toast('已放入文件区 ' + ((r && r.added) || paths.length) + ' 个项目');"),
 ("label: '打开 暂存箱'", "label: '打开 文件'"),
]
for a, b in pairs:
    if a not in s:
        print('MISS ' + a[:40]); continue
    s = s.replace(a, b)
io.open(p, 'w', encoding='utf-8', newline='').write(s)

p2 = r'src/renderer/index.html'
h = io.open(p2, encoding='utf-8').read()
h = h.replace('<span class="dh-main">存到暂存箱</span>', '<span class="dh-main">存到文件区</span>')
h = h.replace('<!-- 文件暂存 -->', '<!-- 文件区 -->')
h = h.replace('<b>松手即可暂存</b>', '<b>松手即可存入文件区</b>')
io.open(p2, 'w', encoding='utf-8', newline='').write(h)
print('done')
