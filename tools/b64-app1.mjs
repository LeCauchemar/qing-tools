import fs from "node:fs";
const p = "src/renderer/app.js";
let s = fs.readFileSync(p, "utf8");

// 1) el refs
const a1 = `  dvOutWrap: $('#dvOutWrap'),`;
if (!s.includes(a1)) { console.error("el anchor"); process.exit(2); }
s = s.replace(a1, a1 + `
  dvImgWrap: $('#dvImgWrap'),
  dvImg: $('#dvImg'),
  dvImgMeta: $('#dvImgMeta'),
  dvFile: $('#dvFile'),
  dvSave: $('#dvSave'),`);

// 2) 替换 b64dec / b64enc 分支 + 新增 helper（放在 dvRun 前）
const anchorFn = `async function dvRun(kind) {`;
if (!s.includes(anchorFn)) { console.error("dvRun anchor"); process.exit(3); }
s = s.replace(anchorFn, `/* ── Base64：图片 ⇄ 文本（带尺寸与内存保护） ───────────────────── */
const B64_VIEW_MAX = 20000; // 输出框最多渲染这么多字符，再长只显示摘要（完整内容仍在 S.dvOut 里，可复制）
const B64_IN_MAX = 8 * 1024 * 1024; // 单次解码上限 8 MB 字符，超过直接提示

function b64Clean(src) {
  let t = String(src || '').replace(/\\s+/g, '');
  let mime = '';
  const m = t.match(/^data:([a-z0-9.+-]+\\/[a-z0-9.+-]+)?;base64,(.*)$/i);
  if (m) {
    mime = (m[1] || '').toLowerCase();
    t = m[2];
  }
  t = t.replace(/-/g, '+').replace(/_/g, '/');
  const bad = t.search(/[^A-Za-z0-9+/=]/);
  if (bad >= 0) {
    const e = new Error('第 ' + (bad + 1) + ' 个字符「' + t[bad] + '」不是 Base64 字符（换行和空格会被自动忽略）');
    e.code = 'badchar';
    throw e;
  }
  t = t.replace(/=+$/, '');
  const rest = t.length % 4;
  if (rest === 1) throw new Error('长度不对：去掉换行后剩 ' + t.length + ' 个字符，Base64 的有效长度不能是 4n+1');
  if (rest) t += '='.repeat(4 - rest);
  return { b64: t, mime };
}

function b64Bytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function sniffImage(b) {
  if (b.length < 4) return '';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  const head = new TextDecoder('utf-8', { fatal: false }).decode(b.slice(0, 400)).trim();
  if (/^<svg[\\s>]/i.test(head) || (/^<\\?xml/i.test(head) && /<svg[\\s>]/i.test(head))) return 'image/svg+xml';
  return '';
}

function humanSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

function dvClearImage() {
  if (S.dvImgUrl) {
    try { URL.revokeObjectURL(S.dvImgUrl); } catch (_) {}
  }
  S.dvImgUrl = '';
  S.dvImgBlob = null;
  S.dvImgName = '';
  if (el.dvImgWrap) el.dvImgWrap.classList.add('hidden');
  if (el.dvImg) el.dvImg.removeAttribute('src');
  if (el.dvSave) el.dvSave.classList.add('hidden');
}

function dvShowImage(blob, name) {
  dvClearImage();
  S.dvImgBlob = blob;
  S.dvImgName = name || 'image';
  S.dvImgUrl = URL.createObjectURL(blob);
  el.dvImg.src = S.dvImgUrl;
  el.dvImgWrap.classList.remove('hidden');
  el.dvSave.classList.remove('hidden');
  el.dvImgMeta.textContent = (name || '图片') + ' · ' + humanSize(blob.size);
  el.dvImg.onload = () => {
    el.dvImgMeta.textContent = (name || '图片') + ' · ' + el.dvImg.naturalWidth + '×' + el.dvImg.naturalHeight + ' · ' + humanSize(blob.size);
  };
}

function dvImageToB64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('这张图读不出来'));
    fr.onload = () => resolve(String(fr.result || ''));
    fr.readAsDataURL(file);
  });
}

async function dvRunImage(file) {
  if (!file) return;
  if (file.size > 6 * 1024 * 1024) {
    S.dvOut = '这张图 ' + humanSize(file.size) + '，太大了。超过 6 MB 的图转成 Base64 会明显卡顿，先压缩一下再试。';
    dvPaint();
    return;
  }
  S.dvOut = '正在读这张图…';
  dvPaint();
  await new Promise((r) => setTimeout(r, 30));
  try {
    const dataUrl = await dvImageToB64(file);
    dvShowImage(file, file.name);
    S.dvOut = dataUrl;
    dvPaint();
    toast('已转成 Base64（' + humanSize(dataUrl.length) + ' 字符）');
  } catch (e) {
    S.dvOut = '出错了：' + ((e && e.message) || e);
    dvPaint();
  }
}

async function dvRun(kind) {`);

// 3) b64enc / b64dec 两个 case 重写
const aEnc = `      case 'b64enc': {
        const bytes = new TextEncoder().encode(raw);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return out(btoa(bin));
      }
      case 'b64dec': {
        const bytes = Uint8Array.from(atob(raw.replace(/\\s+/g, '')), (c) => c.charCodeAt(0));
        return out(new TextDecoder().decode(bytes));
      }`;
if (!s.includes(aEnc)) { console.error("b64 case anchor"); process.exit(4); }
s = s.replace(aEnc, `      case 'b64enc': {
        if (!raw) return out('');
        if (raw.length > 2 * 1024 * 1024) {
          return out('这段内容 ' + humanSize(raw.length) + '，太长了：编码会占好几倍内存。要转图片请点「图片转 Base64」。');
        }
        const bytes = new TextEncoder().encode(raw);
        let bin = '';
        const CH = 0x8000;
        for (let i = 0; i < bytes.length; i += CH) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
        }
        return out(btoa(bin));
      }
      case 'b64dec': {
        dvClearImage();
        if (!raw) return out('');
        if (raw.length > B64_IN_MAX) {
          return out('这串有 ' + humanSize(raw.length) + '，超过单次解码上限 8 MB。\\n大图建议直接点「选图片」读文件，不要把它粘进输入框。');
        }
        out('正在解码…');
        await new Promise((r) => setTimeout(r, 20));
        const { b64, mime } = b64Clean(raw);
        const bytes = b64Bytes(b64);
        if (!bytes.length) return out('解出来是空的');
        const sniff = sniffImage(bytes) || (mime.startsWith('image/') ? mime : '');
        if (sniff) {
          const blob = new Blob([bytes], { type: sniff });
          const ext = sniff.split('/')[1].replace('svg+xml', 'svg').replace('jpeg', 'jpg');
          dvShowImage(blob, 'decoded.' + ext);
          return out('识别成图片（' + sniff + '，' + humanSize(bytes.length) + '）\\n上面就是预览；要存文件点「另存为」，要贴到别处点「复制」拿原始 Base64。');
        }
        const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        const bad = (text.match(/\\uFFFD/g) || []).length;
        if (bad > text.length * 0.2) {
          const head = Array.from(bytes.slice(0, 24)).map((x) => x.toString(16).padStart(2, '0')).join(' ');
          return out('解出来不是文字（' + humanSize(bytes.length) + ' 个字节，前 24 字节：' + head + '）。\\n可能是图片、压缩包或加密数据。');
        }
        S.dvOut = text;
        dvPaint();
        return;
      }`);

fs.writeFileSync(p, s);
console.log("app ok", s.length);