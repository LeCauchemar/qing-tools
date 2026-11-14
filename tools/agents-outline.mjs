import fs from "node:fs";
const p = "AGENTS.md";
const s = fs.readFileSync(p, "utf8");
console.log("bytes", Buffer.byteLength(s), "chars", s.length);
const lines = s.split("\n");
lines.forEach((l, i) => { if (/^##\s/.test(l)) console.log(i + 1, l.slice(0, 70)); });