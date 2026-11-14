import fs from "node:fs";
const p = "src/renderer/app.js";
let s = fs.readFileSync(p, "utf8");
const a = `      if (txt && txt.length > 2 * 1024 * 1024) {
        e.preventDefault();
        toast('这段内容 ' + humanSize(txt.length) + '，直接粘进输入框会让界面卡住。要转图片请用「选图片」，要解码请只粘数据部分。', true);
      }`;
if (!s.includes(a)) { console.error("anchor"); process.exit(2); }
s = s.replace(a, `      if (txt && txt.length > 6 * 1024 * 1024) {
        e.preventDefault();
        toast('这段内容 ' + humanSize(txt.length) + '，粘进输入框会让界面卡住。图片请用「选图片」直接读文件。', true);
        return;
      }
      if (txt && txt.length > 2 * 1024 * 1024) {
        toast('这段有 ' + humanSize(txt.length) + '，粘进去会有点卡；图片建议用「选图片」直接读文件。');
      }`);
fs.writeFileSync(p, s);
console.log("ok", s.length);