import fs from "node:fs";
const p = "src/renderer/app.js";
let s = fs.readFileSync(p, "utf8");

// Esc 优先关咻记录
const a1 = `      if (el.sharePop && !el.sharePop.classList.contains('hidden')) {`;
if (!s.includes(a1)) { console.error("esc anchor"); process.exit(2); }
s = s.replace(a1, `      if (el.shareHist && !el.shareHist.classList.contains('hidden')) {
        e.preventDefault();
        e.stopPropagation();
        closeShareHist();
        return;
      }
` + a1);

fs.writeFileSync(p, s);
console.log("esc ok");