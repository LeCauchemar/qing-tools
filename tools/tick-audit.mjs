import fs from "node:fs";
const s = fs.readFileSync("src/renderer/app.js", "utf8");
const lines = s.split("\n");
lines.forEach((l, i) => {
  if (/setInterval\(/.test(l) || /renderTools\(\)/.test(l) || /function sysTick/.test(l)) console.log(i + 1, l.trim().slice(0, 120));
});