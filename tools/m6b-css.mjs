import fs from "node:fs";
const p = "src/renderer/styles.css";
let s = fs.readFileSync(p, "utf8");
const css = `
/* M6b：小纸条顶部的好友条 + 咻记录 */
.chat-people {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px 7px;
  min-width: 0;
}
.cp-label {
  flex: none;
  font-size: 10.5px;
  letter-spacing: 0.4px;
  color: color-mix(in srgb, var(--ink) 48%, transparent);
}
.cp-list {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.cp-list::-webkit-scrollbar { height: 0; }
.cp-chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 9px 0 4px;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink) 7%, transparent);
  color: var(--ink);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
  transition: background 140ms var(--smooth);
}
.cp-chip:hover { background: color-mix(in srgb, var(--ink) 12%, transparent); }
.cp-av {
  display: grid;
  place-items: center;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  font-style: normal;
  font-weight: 600;
}
.cp-name { max-width: 84px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-add .cp-av { background: color-mix(in srgb, var(--ink) 22%, transparent); }
.cp-more {
  flex: none;
  margin-left: auto;
  border: 0;
  background: transparent;
  color: color-mix(in srgb, var(--ink) 55%, transparent);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  padding: 3px 2px;
}
.cp-more:hover { color: var(--accent); }

.share-hist {
  width: 286px;
  min-width: 240px;
  max-height: 304px;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.share-hist .share-title {
  padding: 9px 12px 7px;
  border-bottom: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sh-list { overflow-y: auto; padding: 4px; display: flex; flex-direction: column; gap: 2px; }
.sh-row {
  display: grid;
  grid-template-columns: 18px 1fr auto;
  gap: 6px;
  align-items: flex-start;
  padding: 6px 7px;
  border-radius: 8px;
}
.sh-row:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
.sh-dir { font-style: normal; font-size: 12px; line-height: 16px; text-align: center; }
.sh-dir.out { color: var(--accent); }
.sh-dir.inn { color: #35d7b0; }
.sh-main { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.sh-main b { font-size: 11.5px; font-weight: 600; }
.sh-main em { font-style: normal; font-size: 10.5px; color: color-mix(in srgb, var(--ink) 52%, transparent); }
.sh-text {
  font-size: 11.5px;
  color: color-mix(in srgb, var(--ink) 74%, transparent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sh-time { font-size: 10px; color: color-mix(in srgb, var(--ink) 45%, transparent); font-variant-numeric: tabular-nums; }
.sh-empty { padding: 14px 12px; text-align: center; font-size: 11.5px; color: color-mix(in srgb, var(--ink) 50%, transparent); }
`;
if (!s.includes("M6b：小纸条顶部的好友条")) s += css;
fs.writeFileSync(p, s);
const open = (s.match(/\{/g) || []).length;
const close = (s.match(/\}/g) || []).length;
console.log("css ok", s.length, "braces", open, close, "fffd", s.includes("\uFFFD"));