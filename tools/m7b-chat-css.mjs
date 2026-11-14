import fs from 'node:fs';

const f = 'src/renderer/styles.css';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('/* 1.16.1：小纸条左栏 */')) {
  console.log('already');
  process.exit(0);
}

const css = `
/* 1.16.1：小纸条左栏（频道 / 好友）+ 右栏（消息） */
#stage[data-state="panel"] .island {
  --isl-w: 640px;
}

.chat-split {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: 10px;
}

.chat-side {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 11px;
  padding: 3px 9px 4px 1px;
  border-right: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.chat-side::-webkit-scrollbar { width: 0; }
.chat-side * { min-width: 0; }

.cs-sec { display: flex; flex-direction: column; gap: 3px; }
.cs-head {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 18px;
  padding-right: 1px;
}
.cs-title {
  font-size: 10.5px;
  letter-spacing: 0.4px;
  color: color-mix(in srgb, var(--ink) 46%, transparent);
}
.cs-add {
  margin-left: auto;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: color-mix(in srgb, var(--ink) 52%, transparent);
  cursor: pointer;
  transition: background 140ms var(--smooth), color 140ms;
}
.cs-add:hover { background: color-mix(in srgb, var(--ink) 10%, transparent); color: var(--ink); }
.cs-add .ic { width: 12px; height: 12px; }

.chat-side .rooms {
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex-wrap: nowrap;
  gap: 3px;
}
.chat-side .room-chip {
  width: 100%;
  height: 30px;
  border-radius: 9px;
  padding: 0 5px 0 8px;
  justify-content: flex-start;
  gap: 5px;
  font-size: 12px;
}
.chat-side .room-chip .r-name {
  flex: 1 1 auto;
  min-width: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-side .room-chip .r-badge:empty { display: none; }
.chat-side .room-chip .r-copy,
.chat-side .room-chip .r-exit { width: 18px; height: 18px; flex: none; }
.chat-side .room-chip .r-copy .ic,
.chat-side .room-chip .r-exit .ic { width: 11px; height: 11px; }
.chat-side .room-chip .r-exit { opacity: 0; }
.chat-side .room-chip:hover .r-exit,
.chat-side .room-chip.active .r-exit { opacity: 1; }

.chat-side .chat-people {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  padding: 0;
}
.chat-side .cp-list {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  overflow: visible;
}
.chat-side .cp-chip {
  width: 100%;
  height: 28px;
  border-radius: 8px;
  padding: 0 8px 0 5px;
  justify-content: flex-start;
  font-size: 12px;
}
.chat-side .cp-name { max-width: none; flex: 1 1 auto; text-align: left; }
.chat-side .cp-more { margin-left: auto; font-size: 10.5px; }
.chat-side .cp-label { display: none; }

.chat-main {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.chat-main .chat-gate,
.chat-main .chat-room { flex: 1; min-height: 0; }

.chat-main .members { margin-bottom: 1px; }
`;

s = s.trimEnd() + '\n' + css + '\n';
fs.writeFileSync(f, s);
const open = (s.match(/{/g) || []).length;
const close = (s.match(/}/g) || []).length;
console.log('css ok', s.length, 'braces', open + ':' + close, 'fffd', s.includes('\uFFFD'));
