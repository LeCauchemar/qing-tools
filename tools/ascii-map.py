# 把截图降采样成 ASCII 亮度图，方便在没有视觉模型时定位异常色块
import sys
from PIL import Image

path = sys.argv[1]
cols = int(sys.argv[2]) if len(sys.argv) > 2 else 96
im = Image.open(path).convert('RGB')
w, h = im.size
rows = max(1, int(cols * h / w / 2.1))
small = im.resize((cols, rows))
chars = ' .:-=+*#%@'
px = small.load()
print('size', w, h, 'grid', cols, rows)
for y in range(rows):
    line = []
    for x in range(cols):
        r, g, b = px[x, y]
        lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        line.append(chars[min(len(chars) - 1, int(lum * len(chars)))])
    print('%3d|%s' % (y, ''.join(line)))
