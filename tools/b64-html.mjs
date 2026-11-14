import fs from "node:fs";
const p = "src/renderer/index.html";
let s = fs.readFileSync(p, "utf8");
const anchor = `                    <textarea class="dv-in" id="dvIn" spellcheck="false" placeholder="粘一段文字、时间戳或 JSON…"></textarea>
                    <div class="dv-acts" id="dvActs"></div>
                    <div class="dv-out hidden" id="dvOutWrap">
                      <textarea class="dv-out" id="dvOut" readonly spellcheck="false"></textarea>
                      <button class="mini dv-copy" data-act="dv-copy">复制</button>
                    </div>`;
if (!s.includes(anchor)) { console.error("anchor"); process.exit(2); }
const add = `                    <textarea class="dv-in" id="dvIn" spellcheck="false" placeholder="粘一段文字、时间戳或 JSON…"></textarea>
                    <div class="dv-img hidden" id="dvImgWrap">
                      <img id="dvImg" alt="预览" />
                      <div class="dv-img-meta" id="dvImgMeta"></div>
                    </div>
                    <div class="dv-acts" id="dvActs"></div>
                    <div class="dv-out hidden" id="dvOutWrap">
                      <textarea class="dv-out" id="dvOut" readonly spellcheck="false"></textarea>
                      <button class="mini dv-copy" data-act="dv-copy">复制</button>
                      <button class="mini dv-save hidden" id="dvSave" data-act="dv-save">另存为</button>
                    </div>
                    <input type="file" id="dvFile" accept="image/*" hidden />`;
s = s.replace(anchor, add);
fs.writeFileSync(p, s);
console.log("html ok", s.length, s.includes("dvFile"));