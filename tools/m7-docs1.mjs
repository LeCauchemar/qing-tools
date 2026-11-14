import fs from "node:fs";
let p = "package.json";
let s = fs.readFileSync(p, "utf8");
s = s.replace(/"version": "\d+\.\d+\.\d+"/, '"version": "1.15.0"');
fs.writeFileSync(p, s);

p = "site/changelog.html";
s = fs.readFileSync(p, "utf8");
s = s.replace("十天，六十个版本", "十天，六十多个版本");
s = s.replace("到 1.11.0，它替你", "到 1.15.0，它替你");
fs.writeFileSync(p, s);

p = "site/index.html";
s = fs.readFileSync(p, "utf8");
s = s.replace(/1\.14\.0/g, "1.15.0");
fs.writeFileSync(p, s);

p = "README.md";
s = fs.readFileSync(p, "utf8");
s = s.replace(/1\.14\.0/g, "1.15.0");
const qing = s.match(/\| \*\*Qing 事项\*\* \|[^\n]*\n/);
if (qing) {
  let row = qing[0];
  row = row.replace("点一下打勾（划掉并变淡）。", "点一下打勾（划掉并变淡）。「全部删除」会保留钉在桌面的条目和没做完的待办。");
  s = s.replace(qing[0], row);
}
const chat = s.match(/\| \*\*小纸条\*\* \|[^\n]*\n/);
if (chat) {
  let row = chat[0];
  row = row.replace("每台电脑可同时加入 **2 个频道**", "顶部有好友条（点开看和 TA 的咻记录）和「咻记录」总览；每台电脑可同时加入 **2 个频道**");
  s = s.replace(chat[0], row);
}
fs.writeFileSync(p, s);
console.log("docs ok", s.length, s.includes("1.15.0"));