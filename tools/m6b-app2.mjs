import fs from "node:fs";
let p = "src/renderer/app.js";
let s = fs.readFileSync(p, "utf8");
const edits = [];

// 1) handleAct 新分支
const a1 = `    case 'friend-accept':
    case 'friend-reject':
    case 'friend-remove': {`;
edits.push([a1, `    case 'cp-friend': {
      await openShareHist(node.dataset.id, node.dataset.name);
      break;
    }
    case 'cp-hist': {
      await openShareHist('', '');
      break;
    }
    case 'cp-bind': {
      setTab('settings');
      const box = $('#accFriendName');
      if (box) setTimeout(() => box.focus(), 260);
      break;
    }
` + a1]);

// 2) 账号状态变化时刷新好友条
const a2 = `  renderAccFriends();
}

function renderAccFriends() {`;
edits.push([a2, `  renderAccFriends();
  renderChatPeople();
}

function renderAccFriends() {`]);

// 3) 咻完刷新
const a3 = `  if (r && r.ok) toast('咻——已经发给 ' + (friend.nick || friend.username));`;
edits.push([a3, a3 + `
  if (r && r.ok) renderChatPeople();`]);

for (const [a, b] of edits) {
  if (!s.includes(a)) { console.error("missing:", a.slice(0, 40)); process.exit(2); }
  s = s.replace(a, b);
}
fs.writeFileSync(p, s);
console.log("app ok", s.length);

p = "src/renderer/index.html";
let h = fs.readFileSync(p, "utf8");
h = h.replace('<button class="cp-more" id="cpMore"', '<button class="cp-more" id="cpMore" data-act="cp-hist"');
fs.writeFileSync(p, h);
console.log("html ok", h.includes('data-act="cp-hist"'));