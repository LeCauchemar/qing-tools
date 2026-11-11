from PIL import Image
import os

pairs = [
    ('shots/212-mail-read.png', 'mail'),
    ('shots/187-chat-emoji-light.png', 'chat'),
    ('shots/176-notes-light.png', 'notes'),
    ('shots/233-todos.png', 'tools'),
    ('shots/242-notch-compact.png', 'notch'),
    ('shots/230-palette.png', 'palette'),
]
os.makedirs('site/assets/shots', exist_ok=True)
for src, name in pairs:
    if not os.path.exists(src):
        print('MISSING', src)
        continue
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    if w > 1200:
        im = im.resize((1200, round(h * 1200 / w)), Image.LANCZOS)
    out = f'site/assets/shots/{name}.webp'
    im.save(out, 'WEBP', quality=84, method=6)
    print(f'{name:8} {im.size[0]}x{im.size[1]}  {os.path.getsize(out) // 1024} KB')
