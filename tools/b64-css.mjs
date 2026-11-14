import fs from "node:fs";
const p = "src/renderer/styles.css";
let s = fs.readFileSync(p, "utf8");
if (!s.includes(".dv-img {")) {
  s += `
/* Base64 图片预览 */
.dv-img {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  margin-top: 6px;
  padding: 8px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--ink) 5%, transparent);
}
.dv-img img {
  max-width: 100%;
  max-height: 150px;
  border-radius: 8px;
  object-fit: contain;
  background: repeating-conic-gradient(color-mix(in srgb, var(--ink) 8%, transparent) 0 25%, transparent 0 50%) 0 0 / 12px 12px;
}
.dv-img-meta {
  font-size: 11px;
  color: color-mix(in srgb, var(--ink) 55%, transparent);
  font-variant-numeric: tabular-nums;
}
.dv-out { max-height: 96px; }
`;
}
fs.writeFileSync(p, s);
const o = (s.match(/\{/g) || []).length, c = (s.match(/\}/g) || []).length;
console.log("css ok", s.length, o, c, s.includes("\uFFFD"));