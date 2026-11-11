import re, sys

p = r'src/renderer/styles.css'
s = open(p, encoding='utf-8').read()

def bump(m):
    v = float(m.group(1))
    if 10.0 <= v <= 13.0:
        nv = v + 1
        return 'font-size: ' + (str(int(nv)) if nv == int(nv) else str(nv)) + 'px'
    return m.group(0)

new, n = re.subn(r'font-size:\s*(\d+(?:\.\d+)?)px', bump, s)
open(p, 'w', encoding='utf-8', newline='').write(new)
print('bumped', n, 'font-size declarations')
