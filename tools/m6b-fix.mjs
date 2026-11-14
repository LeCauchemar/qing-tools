import fs from "node:fs";
const p = "src/renderer/app.js";
let s = fs.readFileSync(p, "utf8");
const a = `  const w = el.shareHist.offsetWidth;
  const h = el.shareHist.offsetHeight;
  let left = Math.min(Math.max(8, rect.left), window.innerWidth - w - 10);
  let top = rect.bottom + 6;
  if (top + h > window.innerHeight - 10) top = Math.max(8, rect.top - h - 6);`;
if (!s.includes(a)) { console.error("anchor"); process.exit(2); }
s = s.replace(a, `  const w = el.shareHist.offsetWidth;
  const h = el.shareHist.offsetHeight;
  // 夹在岛的矩形里 —— 外面 .island 是 overflow:hidden，超出会被直接裁掉
  const isl = el.island.getBoundingClientRect();
  const pad = 10;
  const minLeft = isl.left + pad;
  const maxLeft = isl.right - w - pad;
  let left = Math.min(Math.max(minLeft, rect.left), Math.max(minLeft, maxLeft));
  let top = rect.bottom + 6;
  if (top + h > isl.bottom - pad) top = Math.max(isl.top + pad, rect.top - h - 6);
  if (top + h > isl.bottom - pad) top = Math.max(isl.top + pad, isl.bottom - pad - h);`);
fs.writeFileSync(p, s);
console.log("ok");

const c = "src/renderer/styles.css";
let t = fs.readFileSync(c, "utf8");
t = t.replace(`.sh-empty { padding: 14px 12px;`, `.sh-empty { padding: 10px 12px;`);
t = t.replace(`.share-hist {
  width: 286px;
  min-width: 240px;
  max-height: 304px;`, `.share-hist {
  width: 286px;
  min-width: 240px;
  max-height: min(304px, calc(var(--isl-h, 448px) - 96px));`);
fs.writeFileSync(c, t);
console.log("css ok", t.includes("calc(var(--isl-h"));