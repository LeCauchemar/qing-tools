"""生成应用图标与托盘图标。

产出:
  build/icon.ico        多尺寸应用图标(16/24/32/48/64/128/256)
  build/icon-256.png    预览用大图
  assets/tray.png       16x16 托盘图标(白色药丸，适配深浅任务栏)
  assets/tray@2x.png    32x32
  assets/tray@3x.png    48x48

应用图标：透明背景 + 一枚黑色灵动岛药丸（不带外框、不带描边、不带光晕），
和状态栏里看到的样子一致。
"""

import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
ASSETS = os.path.join(ROOT, "assets")
os.makedirs(BUILD, exist_ok=True)
os.makedirs(ASSETS, exist_ok=True)

S = 1024          # 主画布
SS = 4            # 超采样倍率


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def pill_layer(w, pw, ph, top, bottom):
    """黑色药丸：先画竖向渐变，再用圆角矩形做遮罩。"""
    grad = Image.new("RGB", (1, round(ph)), top)
    gpx = grad.load()
    for y in range(round(ph)):
        gpx[0, y] = lerp(top, bottom, y / max(1, round(ph) - 1))
    grad = grad.resize((round(pw), round(ph)), Image.BILINEAR)

    mask = Image.new("L", (round(pw) * 2, round(ph) * 2), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, round(pw) * 2 - 1, round(ph) * 2 - 1], radius=round(ph), fill=255)
    mask = mask.resize((round(pw), round(ph)), Image.LANCZOS)

    layer = Image.new("RGBA", (round(pw), round(ph)), (0, 0, 0, 0))
    layer.paste(grad.convert("RGBA"), (0, 0), mask)
    return layer


def app_icon(size):
    """透明背景 + 中央黑色药丸 + 左右各两颗小卫星圆（和状态栏里一致）。

    不带外框、不带描边、不带光晕；小圆点是黑岛在深色壁纸上唯一的识别线索，
    所以保留（颜色和 1.9.25 的卫星一致：计时琥珀 / 系统青 / 邮件洋红 / 小纸条靛蓝）。
    """
    w = size * SS
    base = Image.new("RGBA", (w, w), (0, 0, 0, 0))

    margin = w * 0.03
    dot = w * 0.058
    gap_dot = w * 0.014
    gap_pill = w * 0.022

    side = 2 * dot + gap_dot + gap_pill          # 一侧「两颗圆点 + 间距」
    pw = w - 2 * (margin + side)
    ph = w * 0.20
    px = margin + side
    py = (w - ph) / 2

    pill = pill_layer(w, pw, ph, (26, 29, 39), (8, 9, 14))
    base.alpha_composite(pill, (round(px), round(py)))

    d = ImageDraw.Draw(base)
    cy = w / 2
    colors = [(255, 197, 49), (41, 211, 192), (255, 95, 168), (123, 140, 255)]
    r = dot / 2
    left_far = margin + r
    left_near = margin + r + dot + gap_dot
    right_near = w - margin - r - dot - gap_dot
    right_far = w - margin - r
    for cx, c in ((left_far, colors[1]), (left_near, colors[0]),
                  (right_near, colors[2]), (right_far, colors[3])):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c + (255,))

    return base.resize((size, size), Image.LANCZOS)


def tray_icon(size, color=(255, 255, 255, 255)):
    """单色药丸 + 镂空圆点，深浅任务栏都能看清。"""
    w = size * SS * 4
    img = Image.new("RGBA", (w, w), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    pw, ph = w * 0.94, w * 0.46
    px, py = (w - pw) / 2, (w - ph) / 2
    d.rounded_rectangle([px, py, px + pw, py + ph], radius=ph / 2, fill=color)

    r = ph * 0.19
    cx = px + ph * 0.62
    cy = py + ph / 2
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(0, 0, 0, 0))

    return img.resize((size, size), Image.LANCZOS)


# ---- 应用图标 ----
big = app_icon(256)
big.save(os.path.join(BUILD, "icon-256.png"))
sizes = [16, 24, 32, 48, 64, 128, 256]
imgs = [app_icon(s) for s in sizes]
imgs[-1].save(
    os.path.join(BUILD, "icon.ico"),
    format="ICO",
    sizes=[(s, s) for s in sizes],
    append_images=imgs[:-1],
)

# ---- 托盘图标 ----
# 16px 用加粗药丸，保证在任务栏仍然可辨
for name, s in (("tray.png", 16), ("tray@2x.png", 32), ("tray@3x.png", 48)):
    tray_icon(s).save(os.path.join(ASSETS, name))

print("ok", [f"{s}px" for s in sizes])
