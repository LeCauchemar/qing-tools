import fs from "node:fs";
const p = "src/renderer/index.html";
let s = fs.readFileSync(p, "utf8");
const anchor = `                    <textarea class="dv-in" id="dvIn" spellcheck="false" placeholder="粘一段文字、时间戳或 JSON…"></textarea>`;
if (!s.includes(anchor)) { console.error("no anchor"); process.exit(2); }
const bar = `${anchor}
                    <div class="dv-src hidden" id="dvSrcBar">
                      <span class="dv-src-text" id="dvSrcText"></span>
                      <button class="mini" data-act="dv-src-copy">复制</button>
                      <button class="mini" data-act="dv-src-clear">清空</button>
                    </div>`;
s = s.replace(anchor, bar);
fs.writeFileSync(p, s);
console.log("html ok", s.includes("dvSrcBar"));