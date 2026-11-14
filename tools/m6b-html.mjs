import fs from "node:fs";
const p = "src/renderer/index.html";
let s = fs.readFileSync(p, "utf8");
const anchor = `              <!-- 频道（最多两个） -->
              <div class="rooms hidden" id="chatRooms"></div>
`;
if (!s.includes(anchor)) { console.error("anchor missing"); process.exit(2); }
s = s.replace(anchor, anchor + `
              <!-- 好友 + 咻记录（M6b） -->
              <div class="chat-people hidden" id="chatPeople">
                <span class="cp-label">好友</span>
                <div class="cp-list" id="cpList"></div>
                <button class="cp-more" id="cpMore" title="我和好友之间咻过的所有条目">咻记录</button>
              </div>
`);
const anchor2 = `      <div class="msg-menu hidden" id="sharePop">`;
if (!s.includes(anchor2)) { console.error("anchor2 missing"); process.exit(3); }
s = s.replace(anchor2, `      <!-- 咻记录 -->
      <div class="msg-menu hidden share-hist" id="shareHist">
        <div class="share-title" id="shTitle">咻记录</div>
        <div class="sh-list" id="shList"></div>
        <p class="sh-empty hidden" id="shEmpty">还没有咻过东西</p>
      </div>
` + anchor2);
fs.writeFileSync(p, s);
console.log("html ok", s.length);