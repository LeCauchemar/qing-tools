import fs from "node:fs";
const s = fs.readFileSync("site/changelog.html", "utf8");
console.log((s.match(/<h1>[\s\S]*?<\/h1>/) || [""])[0].replace(/\s+/g, " "));
console.log((s.match(/cl-side"><b>([^<]+)/g) || []).slice(0, 3).join(" | "));
console.log("fffd", s.includes("\uFFFD"), "len", s.length);