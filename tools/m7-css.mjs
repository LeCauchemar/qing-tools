// 追加 M7 需要的两条样式（只用 node 读写，避免 PowerShell 破坏 UTF-8）
import fs from 'node:fs';
const f = 'src/renderer/styles.css';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('/* M7：同步副本')) {
  console.log('already');
  process.exit(0);
}
const css = [
  '',
  '/* M7：同步副本 / 云端图片占位 */',
  '.tag.conflict {',
  '  background: color-mix(in srgb, #ffb020 22%, transparent);',
  '  color: color-mix(in srgb, var(--ink) 88%, #7a4b00);',
  '}',
  '.row.note .note-cloud-wait {',
  '  font-size: 12px;',
  '  color: color-mix(in srgb, var(--ink) 58%, transparent);',
  '}'
].join('\n');
s = s.trimEnd() + '\n' + css + '\n';
fs.writeFileSync(f, s);
const open = (s.match(/{/g) || []).length;
const close = (s.match(/}/g) || []).length;
console.log('css ok', s.length, 'braces', open + ':' + close, 'fffd', s.includes('\uFFFD'));
