import fs from "node:fs";
const p = "src/renderer/app.js";
let s = fs.readFileSync(p, "utf8");

// 入口：读 payload，大串移出 DOM
const a1 = `async function dvRun(kind) {
  const raw = ((el.dvIn && el.dvIn.value) || '').trim();`;
if (!s.includes(a1)) { console.error("dvRun"); process.exit(2); }
s = s.replace(a1, `async function dvRun(kind) {
  let raw = (dvPayload() || '').trim();
  // 一大段文字留在 textarea 里，输入/滚动都会整段重排 —— 超过 20 万字符就搬到内存，输入框只留一行说明
  if (el.dvIn && el.dvIn.value && el.dvIn.value.length > B64_INLINE_MAX) {
    dvSetSrc(raw, '已读入 ' + humanSize(raw.length) + ' 的 ' + (kind.startsWith('b64') ? 'Base64' : '文本') + '（不放进输入框，避免卡顿）');
    raw = (S.dvSrc || '').trim();
  }`);

// 粘贴：大串直接进内存，而不是塞进 textarea
const a2 = `      if (txt && txt.length > 6 * 1024 * 1024) {
        e.preventDefault();
        toast('这段内容 ' + humanSize(txt.length) + '，粘进输入框会让界面卡住。图片请用「选图片」直接读文件。', true);
        return;
      }
      if (txt && txt.length > 2 * 1024 * 1024) {
        toast('这段有 ' + humanSize(txt.length) + '，粘进去会有点卡；图片建议用「选图片」直接读文件。');
      }`;
if (!s.includes(a2)) { console.error("paste"); process.exit(3); }
s = s.replace(a2, `      if (txt && txt.length > B64_INLINE_MAX) {
        e.preventDefault();
        dvSetSrc(txt, '已读入 ' + humanSize(txt.length) + '（不放进输入框，避免卡顿）');
        toast('这段有 ' + humanSize(txt.length) + '，已放进内存；直接点「解码」或「编码」就行。');
        return;
      }`);

// input 事件：万一还是通过别的方式写进超长文本，也立刻搬走
const a3 = `  if (el.dvIn) {
    el.dvIn.addEventListener('input', () => dvPaint());`;
if (!s.includes(a3)) { console.error("input"); process.exit(4); }
s = s.replace(a3, `  if (el.dvIn) {
    el.dvIn.addEventListener('input', () => {
      if (el.dvIn.value.length > B64_INLINE_MAX) {
        dvSetSrc(el.dvIn.value, '已读入 ' + humanSize(el.dvIn.value.length) + '（不放进输入框，避免卡顿）');
      }
      dvPaint();
    });`);

// dvPaint 末尾同步来源条
const a4 = `  if (el.dvSave) el.dvSave.classList.toggle('hidden', !S.dvImgBlob);`;
if (!s.includes(a4)) { console.error("paint"); process.exit(5); }
s = s.replace(a4, a4 + `
  dvPaintSrc();`);

fs.writeFileSync(p, s);
console.log("part2 ok", s.length);