import io
import re
p = r'src/renderer/styles.css'
s = io.open(p, encoding='utf-8').read()
# 把两个 --isl-shadow 定义（跨行）替换成单行扁平阴影
s = re.sub(r"--isl-shadow: 0 6px 18px[^;]*;", "--isl-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);", s, flags=re.S)
s = re.sub(r"--isl-shadow: 0 8px 22px[^;]*;", "--isl-shadow: 0 2px 8px rgba(20, 26, 44, 0.12);", s, flags=re.S)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
