import io
p = r'src/renderer/styles.css'
s = io.open(p, encoding='utf-8').read()
old = """.sat .snum {
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.3px;
}"""
new = """.sat .snum {
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.3px;
  line-height: 1;
  display: block;
  transform: translateY(-0.6px);
}"""
if old not in s:
    print('MISS snum')
else:
    s = s.replace(old, new)
    print('snum ok')

old2 = """.sat .sval {
  position: relative;
  font-size: 11px;
  font-weight: 600;"""
new2 = """.sat .sval {
  position: relative;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  transform: translateY(-0.4px);"""
if old2 in s:
    s = s.replace(old2, new2)
    print('sval ok')
else:
    print('MISS sval')
io.open(p, 'w', encoding='utf-8', newline='').write(s)
