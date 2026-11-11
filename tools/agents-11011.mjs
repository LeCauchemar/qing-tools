import fs from 'node:fs';
const p = 'D:/deepseek harness daily/AGENTS.md';
let s = fs.readFileSync(p, 'utf8');
if (!s.includes('## 1.10.11 原生控件')) {
  s += [
    '',
    '## 1.10.11 原生控件 color-scheme',
    '- 页面从没声明过 `color-scheme`：Chromium 对 `datetime-local`/`time`/`select`/滚动条一律按**浅色 scheme** 画内部，深色面板上就成了黑字黑底（用户截图「年月日看不见」）。已在 `styles.css` 提醒段加 `html[data-theme="dark"]{color-scheme:dark}` / `html[data-theme="light"]{color-scheme:light}`，以后加原生控件不用再单独调色。',
    '- `.rem-when input[type="datetime-local"]` 统一 26px 高 + `color: var(--ink)` + `font-variant-numeric: tabular-nums`；`::-webkit-calendar-picker-indicator` 默认 55% 不透明度、hover 92%，聚焦加强调色描边。',
    '- 提醒卡下面那段「到点会像拍一拍那样抖一下…」的提示已整块删除（`#remEmpty` 元素一起去掉，`renderReminders()` 里本来就 `if (el.remEmpty)` 保护），别再补回来。',
    '',
  ].join('\n');
  fs.writeFileSync(p, s);
  console.log('agents ok');
} else console.log('agents skip');
