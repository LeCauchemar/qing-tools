import io
p = r'src/renderer/styles.css'
s = io.open(p, encoding='utf-8').read()
s = s.replace("  transform: translateY(-0.6px);\n}", "  transform: translateY(0.3px);\n}")
s = s.replace("  transform: translateY(-0.4px);", "  transform: translateY(0.3px);")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
