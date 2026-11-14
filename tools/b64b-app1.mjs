import fs from "node:fs";
const p = "src/renderer/app.js";
let s = fs.readFileSync(p, "utf8");

const a1 = `  dvImgName: '',`;
if (!s.includes(a1)) { console.error("S"); process.exit(2); }
s = s.replace(a1, a1 + `
  dvSrc: '',
  dvSrcNote: '',`);

const a2 = "const B64_VIEW_MAX = 20000;";
if (!s.includes(a2)) { console.error("const"); process.exit(3); }
s = s.replace(a2, a2 + `
const B64_INLINE_MAX = 200000; // 超过这个长度就不放进 textarea（留在内存里），否则每帧重排会卡死`);

const a3 = "/* ---------------- 开发小工具 ---------------- */";
const helpers = `// 大段内容不要留在 textarea 里：浏览器每帧都要为它重排，几千行就够把动画拖成 PPT
function dvPayload() {
  const typed = el.dvIn ? el.dvIn.value : '';
  return typed.trim() ? typed : S.dvSrc;
}

function dvPaintSrc() {
  if (!el.dvSrcBar) return;
  const on = !!S.dvSrc;
  el.dvSrcBar.classList.toggle('hidden', !on);
  if (on && el.dvSrcText) el.dvSrcText.textContent = S.dvSrcNote || ('已读入 ' + humanSize(S.dvSrc.length));
}

function dvSetSrc(text, note) {
  S.dvSrc = text || '';
  S.dvSrcNote = note || '';
  if (el.dvIn) el.dvIn.value = '';
  dvPaintSrc();
}

function dvClearSrc() {
  S.dvSrc = '';
  S.dvSrcNote = '';
  if (el.dvIn) el.dvIn.value = '';
  dvPaintSrc();
}

/* ---------------- 开发小工具 ---------------- */`;
if (!s.includes(a3)) { console.error("tools anchor"); process.exit(4); }
s = s.replace(a3, helpers);

const a4 = `  dvIn: $('#dvIn'),`;
s = s.replace(a4, a4 + `
  dvSrcBar: $('#dvSrcBar'),
  dvSrcText: $('#dvSrcText'),`);

fs.writeFileSync(p, s);
console.log("part1 ok", s.length);