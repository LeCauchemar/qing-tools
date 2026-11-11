import io
p = r'src/renderer/styles.css'
s = io.open(p, encoding='utf-8').read()
pairs = [
 ("background: linear-gradient(160deg, #4a5570, #2a3044);", "background: #3b4459;"),
 ("background: linear-gradient(160deg, #4f7d5a, #2a4a35);", "background: #3c6b4c;"),
 ("background: linear-gradient(160deg, #4a6a9c, #2b3f63);", "background: #3d5c8c;"),
 ("background: linear-gradient(160deg, #a4444f, #63222b);", "background: #94404a;"),
 ("background: linear-gradient(160deg, #8a6a34, #55401c);", "background: #7d6232;"),
 ("background: linear-gradient(160deg, #6a5bb0, #3a3068);", "background: #5f52a0;"),
 ("background: linear-gradient(180deg, rgba(143, 123, 255, 0.95), rgba(118, 96, 238, 0.95));", "background: var(--accent);"),
 ("background: linear-gradient(90deg, var(--accent), rgba(143, 123, 255, 0.35));", "background: var(--accent);"),
 ("background: linear-gradient(160deg, rgba(143, 123, 255, 0.28), rgba(143, 123, 255, 0.1));", "background: color-mix(in srgb, var(--accent) 20%, transparent);"),
]
for a, b in pairs:
    if a not in s:
        print('MISS ' + a[:52])
        continue
    s = s.replace(a, b)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('done')
