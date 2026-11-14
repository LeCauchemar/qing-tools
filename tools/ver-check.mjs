import fs from "node:fs";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
console.log("ver", pkg.version);
const s = fs.readFileSync("site/changelog.html", "utf8");
const m = s.match(/<b>(\d+)<\/b>[\s\S]{0,20}?个可安装版本/);
console.log("hero", m && m[0].replace(/\s+/g, " "));
const items = s.match(/<article class="cl-item[\s\S]{0,90}/g) || [];
console.log("items", items.length);
console.log("last", items.slice(-1)[0].replace(/\s+/g, " "));