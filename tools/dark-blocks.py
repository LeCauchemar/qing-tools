# 在浅色截图里找出「深色小块」的包围盒，用于定位异常黑条
import sys
from PIL import Image

path = sys.argv[1]
thresh = int(sys.argv[2]) if len(sys.argv) > 2 else 70
im = Image.open(path).convert('RGB')
w, h = im.size
px = im.load()

# 以 4px 为步长扫描，统计每行/每列的深色像素数
step = 4
rows = {}
cols = {}
for y in range(0, h, step):
    n = 0
    for x in range(0, w, step):
        r, g, b = px[x, y]
        if (r + g + b) / 3 < thresh:
            n += 1
            cols[x] = cols.get(x, 0) + 1
    if n:
        rows[y] = n

print('size', w, h, 'thresh', thresh)
print('dark rows (count):')
for y in sorted(rows):
    if rows[y] >= 2:
        print('  y=%d n=%d' % (y, rows[y]))
print('dark cols range:', (min(cols), max(cols)) if cols else None)
# 聚类成块
blocks = []
cur = None
for y in sorted(rows):
    if rows[y] < 2:
        continue
    if cur and y - cur[1] <= step * 2:
        cur[1] = y
    else:
        if cur:
            blocks.append(tuple(cur))
        cur = [y, y]
if cur:
    blocks.append(tuple(cur))
print('blocks (y0,y1):', blocks)
