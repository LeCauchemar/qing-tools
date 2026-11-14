import fs from 'node:fs';

const p = 'src/renderer/styles.css';
let s = fs.readFileSync(p, 'utf8');
const marker = '/* M4：Qing事项（备忘录 + 待办） */';
if (s.includes(marker)) {
  console.log('already appended');
  process.exit(0);
}
const css = `
/* M4：Qing事项（备忘录 + 待办） */
.note-type {
  display: flex;
  gap: 6px;
  padding: 0 2px 8px;
}
.nt-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 11px;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  color: color-mix(in srgb, var(--ink) 70%, transparent);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background 140ms var(--smooth), color 140ms var(--smooth);
}
.nt-chip .ic { width: 13px; height: 13px; }
.nt-chip:hover { background: color-mix(in srgb, var(--ink) 10%, transparent); }
.nt-chip.on { background: var(--accent); color: #fff; }
.nt-chip.on:hover { background: var(--accent); }

.row.note.todo { align-items: flex-start; }
.row.note.todo > .check-btn { margin-top: 0; }
.row.note.todo.done .row-text,
.row.note.todo.done .note-rich { opacity: 0.55; text-decoration: line-through; }
.row.note.todo.done .row-sub .tag { opacity: 0.7; }

.check-btn {
  flex: none;
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
  border-radius: 50%;
  background: transparent;
  color: color-mix(in srgb, var(--ink) 45%, transparent);
  cursor: pointer;
  transition: background 140ms var(--smooth), border-color 140ms var(--smooth), color 140ms var(--smooth);
}
.check-btn .ic { width: 12px; height: 12px; }
.check-btn:hover { border-color: var(--accent); color: var(--accent); }
.check-btn.on { background: var(--accent); border-color: var(--accent); color: #fff; }

.icon-btn.tool.locked,
.icon-btn.tool[disabled] { opacity: 0.3; cursor: not-allowed; pointer-events: none; }
`;
s = s.replace(/\s*$/, '\n') + css;
fs.writeFileSync(p, s, 'utf8');
const open = (s.match(/\{/g) || []).length;
const close = (s.match(/\}/g) || []).length;
console.log('appended; len', s.length, 'braces', open + ':' + close, 'fffd', s.includes('\uFFFD'));
