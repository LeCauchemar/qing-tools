import fs from "node:fs";
const p = "src/renderer/styles.css";
let s = fs.readFileSync(p, "utf8");
if (!s.includes(".dv-src {")) {
  s += `
/* 超长内容不进输入框：内存里放着，这里只显示一行说明 */
.dv-src {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding: 6px 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  outline: 1px solid color-mix(in srgb, var(--accent) 32%, transparent);
  outline-offset: -1px;
}
.dv-src-text {
  flex: 1;
  min-width: 0;
  font-size: 11.5px;
  color: color-mix(in srgb, var(--ink) 72%, transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.dv-src .mini {
  flex: none;
  font-size: 11px;
  padding: 3px 8px;
}
`;
}
fs.writeFileSync(p, s);
const o = (s.match(/\{/g) || []).length, c = (s.match(/\}/g) || []).length;
console.log("css", s.length, o, c, s.includes("\uFFFD"));