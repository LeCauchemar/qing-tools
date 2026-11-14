import fs from "node:fs";
const p = "src/renderer/app.js";
let s = fs.readFileSync(p, "utf8");

// S 字段
const a1 = `  dvOut: '',`;
if (!s.includes(a1)) { console.error("S anchor"); process.exit(2); }
s = s.replace(a1, a1 + `
  dvImgUrl: '',
  dvImgBlob: null,
  dvImgName: '',`);

// DV_ACTS b64 增加图片
const a2 = `  b64: [
    { k: 'b64enc', t: '编码' },
    { k: 'b64dec', t: '解码' }
  ],`;
s = s.replace(a2, `  b64: [
    { k: 'b64enc', t: '文字 → Base64' },
    { k: 'b64dec', t: 'Base64 → 文字/图片' },
    { k: 'b64img', t: '选图片…' }
  ],`);

// dvPaint 截断 + 保存按钮显隐
const a3 = `  const v = S.dvOut || '';
  el.dvOutWrap.classList.toggle('hidden', !v);
  if (el.dvOut) el.dvOut.value = v;`;
s = s.replace(a3, `  const full = S.dvOut || '';
  el.dvOutWrap.classList.toggle('hidden', !full);
  const shown = full.length > B64_VIEW_MAX
    ? full.slice(0, B64_VIEW_MAX) + '\\n…（共 ' + full.length + ' 字符，这里只显示前 ' + B64_VIEW_MAX + ' 个避免卡顿；点「复制」拿到的是完整内容）'
    : full;
  if (el.dvOut) el.dvOut.value = shown;
  if (el.dvSave) el.dvSave.classList.toggle('hidden', !S.dvImgBlob);`);

// dv-file / dv-save 动作 + 文件选择 + 粘贴保护
const a4 = `      if (t.closest && t.closest('[data-act="dv-copy"]')) {
        if (!S.dvOut) return;
        api.clips.writeText(S.dvOut).then((r) => toast(r && r.ok === false ? '复制失败' : '已复制到剪贴板'));
      }`;
if (!s.includes(a4)) { console.error("copy anchor"); process.exit(3); }
s = s.replace(a4, a4 + `
      if (t.closest && t.closest('[data-act="dv-save"]')) {
        if (!S.dvImgUrl) return;
        const a = document.createElement('a');
        a.href = S.dvImgUrl;
        a.download = S.dvImgName || 'image.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast('已保存到下载文件夹：' + a.download);
        return;
      }`);

const a5 = `  if (el.dvIn) {
    el.dvIn.addEventListener('input', () => dvPaint());`;
if (!s.includes(a5)) { console.error("dvIn anchor"); process.exit(4); }
s = s.replace(a5, `  if (el.dvFile) {
    el.dvFile.addEventListener('change', () => {
      const f = el.dvFile.files && el.dvFile.files[0];
      if (f) dvRunImage(f);
      el.dvFile.value = '';
    });
  }
  if (el.dvIn) {
    // 兜底：图片直接粘进这个框（而不是把几 MB 的 base64 塞进 textarea）
    el.dvIn.addEventListener('paste', (e) => {
      const items = (e.clipboardData && e.clipboardData.items) || [];
      for (const it of items) {
        if (it.type && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) {
            e.preventDefault();
            dvRunImage(f);
            return;
          }
        }
      }
      const txt = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
      if (txt && txt.length > 2 * 1024 * 1024) {
        e.preventDefault();
        toast('这段内容 ' + humanSize(txt.length) + '，直接粘进输入框会让界面卡住。要转图片请用「选图片」，要解码请只粘数据部分。', true);
      }
    });
    el.dvIn.addEventListener('input', () => dvPaint());`);

// b64img 动作 → 打开文件选择
const a6 = `      case 'b64enc': {`;
if (!s.includes(a6)) { console.error("enc anchor"); process.exit(5); }
s = s.replace(a6, `      case 'b64img': {
        if (el.dvFile) el.dvFile.click();
        return;
      }
      case 'b64enc': {`);

fs.writeFileSync(p, s);
console.log("ok", s.length);