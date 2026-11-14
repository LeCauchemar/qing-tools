import fs from "node:fs";
const p = "src/renderer/app.js";
let s = fs.readFileSync(p, "utf8");
const a = `  el.dvImg.onload = () => {
    el.dvImgMeta.textContent = (name || '图片') + ' · ' + el.dvImg.naturalWidth + '×' + el.dvImg.naturalHeight + ' · ' + humanSize(blob.size);
  };`;
if (!s.includes(a)) { console.error("anchor"); process.exit(2); }
s = s.replace(a, `  el.dvImg.onload = () => {
    el.dvImgMeta.textContent = (name || '图片') + ' · ' + el.dvImg.naturalWidth + '×' + el.dvImg.naturalHeight + ' · ' + humanSize(blob.size);
    el.dvImg.dataset.ok = '1';
  };
  el.dvImg.onerror = () => {
    el.dvImgMeta.textContent = (name || '图片') + ' · ' + humanSize(blob.size) + ' · 数据不完整，显示不出来';
    el.dvImg.dataset.ok = '0';
  };`);

// 解码后等图片真的解码出来，坏数据要说清楚
const b = `          dvShowImage(blob, 'decoded.' + ext);
          return out('识别成图片（' + sniff + '，' + humanSize(bytes.length) + '）\\n上面就是预览；要存文件点「另存为」，要贴到别处点「复制」拿原始 Base64。');`;
if (!s.includes(b)) { console.error("b anchor"); process.exit(3); }
s = s.replace(b, `          dvShowImage(blob, 'decoded.' + ext);
          await new Promise((r) => setTimeout(r, 120));
          if (el.dvImg && el.dvImg.dataset.ok === '0') {
            dvClearImage();
            return out('这串 Base64 开头像 ' + sniff + '，但数据不完整（' + humanSize(bytes.length) + '），图片显示不出来。\\n多半是从中间截断了：让发的人重新复制完整的一串，或者直接发图片文件。');
          }
          return out('识别成图片（' + sniff + '，' + humanSize(bytes.length) + '）\\n上面就是预览；要存文件点「另存为」，要贴到别处点「复制」拿原始 Base64。');`);

fs.writeFileSync(p, s);
console.log("ok");