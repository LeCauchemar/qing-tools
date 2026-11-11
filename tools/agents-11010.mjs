import fs from 'node:fs';
const p = 'D:\\deepseek harness daily\\AGENTS.md';
const s = fs.readFileSync(p, 'utf8');
const add = [
  '',
  '',
  '## 1.10.10 主题对比度 + 真·跑马灯',
  '- 次要文字统一用 `color-mix(in srgb, var(--ink) N%, transparent)`，不要再写 `--muted`/`--dim` 的写死 hex：`.row-sub` 68%、`.row .time` 58%、`.tc-sum` 66%、`.cd-label` 66%、`.cd-badge` 80% 文字 + 10% 底。写死色在深浅两套主题下对比度会岔开（深色偏灰、浅色偏淡），用户直接反馈可读性差。',
  '- 边缘彩虹必须画在 `.island` **内侧**（`inset: 0`）：`.island` 是 `overflow: hidden`，画到外侧（`inset: -3px`）会被裁掉，只剩顶边一条直线（1.10.9 的 bug）。',
  '- 跑马灯用 `conic-gradient(from var(--rim-a))` + `@property --rim-a { syntax: "<angle>" }` + `@keyframes rimSpin { to { --rim-a: 360deg } }`，1.9s 一圈；`linear-gradient` 只能做流光、不能沿边跑。加了 `prefers-reduced-motion` 兜底。',
  ''
].join('\n');
fs.writeFileSync(p, s + add);
console.log('agents ok');
