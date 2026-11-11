import fs from 'node:fs';
const p = 'D:\\deepseek harness daily\\AGENTS.md';
let s = fs.readFileSync(p, 'utf8');
const key = '## 1.10.11 原生控件 color-scheme';
const i = s.indexOf(key);
if (i < 0) { console.log('no anchor'); process.exit(1); }
const add = [
  '- **标题栏补充信息**：`index.html` 的 `.brand` 里 `#clock` 后面是 `#headExtra`；`.brand{flex:1;padding-right:8px}` + `.brand-extra{flex:1 1 auto;min-width:0;11.5px;58% ink;省略号}`。文案由 `renderHeadExtra()`（app.js，紧跟 `renderIdleSub()`）拼「M月D日 周X · 农历/节日 · 温度 天气」，由 `renderIdleSub()` 末尾调用 —— 天气/农历变了会自动同步，不要另开定时器。',
  '- **字号档位（1.10.11 起）**：`.peek-top span` 12.5px/500/62% ink/右对齐；小纸条 `.msg .who` 11px、`.msg .bub` 14.5px（padding 8/11、line-height 1.5）、`.msg .time` 10.5px、`.msg.sys .bub` 12.5px。次要文字一律 `color-mix(in srgb, var(--ink) N%, transparent)`，不要用写死的 `--dim`/`--muted`（深浅主题强度对不齐）。'
];
const tail = s.indexOf('\n', i + key.length);
const rest = s.slice(tail + 1);
const nextHeading = rest.search(/\n## /);
const block = nextHeading >= 0 ? rest.slice(0, nextHeading) : rest;
const merged = block.replace(/\s*$/, '\n') + add.join('\n') + '\n';
s = s.slice(0, tail + 1) + merged + (nextHeading >= 0 ? rest.slice(nextHeading) : '');
fs.writeFileSync(p, s);
console.log('ok', s.length, s.includes('标题栏补充信息'), /\uFFFD/.test(s));
