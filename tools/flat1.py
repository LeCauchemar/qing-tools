import io
p = r'src/renderer/styles.css'
s = io.open(p, encoding='utf-8').read()
pairs = [
 ("--surface-glow-1: radial-gradient(120% 150% at 50% -40%, rgba(140, 140, 190, 0.22), transparent 62%);", "--surface-glow-1: none;"),
 ("--surface-glow-2: radial-gradient(80% 100% at 100% 120%, rgba(120, 90, 200, 0.14), transparent 60%);", "--surface-glow-2: none;"),
 ("--surface-base: linear-gradient(180deg, #10121b 0%, #080910 46%, #05060b 100%);", "--surface-base: #0f1117;\n  --surface-line: rgba(255, 255, 255, 0.09);"),
 ("--noise-opacity: 0.05;", "--noise-opacity: 0;"),
 ("--surface-glow-1: radial-gradient(120% 150% at 50% -40%, rgba(255, 255, 255, 0.95), transparent 62%);", "--surface-glow-1: none;"),
 ("--surface-glow-2: radial-gradient(80% 100% at 100% 120%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 62%);", "--surface-glow-2: none;"),
 ("--surface-base: linear-gradient(180deg, #ffffff 0%, #f4f6fb 52%, #eef1f7 100%);", "--surface-base: #ffffff;\n  --surface-line: rgba(20, 26, 44, 0.10);"),
 ("--noise-opacity: 0.035;", "--noise-opacity: 0;"),
]
for a, b in pairs:
    if a not in s:
        print('MISS ' + a[:56])
        continue
    s = s.replace(a, b)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('done')
