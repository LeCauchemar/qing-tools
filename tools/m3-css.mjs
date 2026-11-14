// 一次性：给 styles.css 追加「归属」卡片样式（M3）
import fs from 'node:fs';

const p = 'src/renderer/styles.css';
let s = fs.readFileSync(p, 'utf8');
if (!s.includes('.claim-box')) {
  s += `
/* 账号：本机数据归属卡片（M3） */
.claim-box {
  border: 1px solid color-mix(in srgb, var(--accent) 26%, transparent);
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  border-radius: 12px;
  padding: 10px 12px;
  margin: 6px 0 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.claim-text { font-size: 12.5px; line-height: 1.6; color: var(--ink); }
.claim-text b { color: var(--accent); }
`;
  fs.writeFileSync(p, s, 'utf8');
}
const out = fs.readFileSync(p, 'utf8');
const open = (out.match(/\{/g) || []).length;
const close = (out.match(/\}/g) || []).length;
console.log('len', out.length, 'braces', open, close, 'fffd', out.includes('\uFFFD'), 'has', out.includes('.claim-box'));
