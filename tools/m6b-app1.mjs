import fs from "node:fs";
const p = "src/renderer/app.js";
let s = fs.readFileSync(p, "utf8");

// 1) el refs
const anchorEl = `  shareEmpty: $('#shareEmpty'),
  hearts: $('#hearts'),`;
if (!s.includes(anchorEl)) { console.error("el anchor"); process.exit(2); }
s = s.replace(anchorEl, anchorEl + `
  chatPeople: $('#chatPeople'),
  cpList: $('#cpList'),
  cpMore: $('#cpMore'),
  shareHist: $('#shareHist'),
  shTitle: $('#shTitle'),
  shList: $('#shList'),
  shEmpty: $('#shEmpty'),`);

// 2) hook renderChatPeople at end of chatRenderRooms
const anchorRooms = `    (rooms.length < CHAT_MAX
      ? '<button class="room-add" data-act="room-add" title="再加一个频道（最多 2 个）">+</button>'
      : '');
}`;
if (!s.includes(anchorRooms)) { console.error("rooms anchor"); process.exit(3); }
s = s.replace(anchorRooms, `    (rooms.length < CHAT_MAX
      ? '<button class="room-add" data-act="room-add" title="再加一个频道（最多 2 个）">+</button>'
      : '');
  renderChatPeople();
}`);

// 3) insert functions before closeSharePop
const anchorFn = `function closeSharePop() {`;
s = s.replace(anchorFn, `/* 小纸条顶部的好友条：绑过的人一排，点开看和 TA 的咻记录 */
function renderChatPeople() {
  if (!el.chatPeople) return;
  const on = !!S.account.signedIn;
  el.chatPeople.classList.toggle('hidden', !on);
  if (!on) return;
  const friends = S.account.friends || [];
  let html = friends
    .map((f) => {
      const name = f.nick || f.username;
      return (
        '<button class="cp-chip" data-act="cp-friend" data-id="' + esc(f.id) + '" data-name="' + esc(name) + '" title="' + esc('看看和 ' + name + ' 的咻记录') + '">' +
        '<i class="cp-av">' + esc(String(name).slice(0, 1).toUpperCase()) + '</i>' +
        '<span class="cp-name">' + esc(name) + '</span>' +
        '</button>'
      );
    })
    .join('');
  if (!friends.length) {
    html =
      '<button class="cp-chip cp-add" data-act="cp-bind" title="去设置里绑定一个好友">' +
      '<i class="cp-av">+</i><span class="cp-name">绑定好友</span></button>';
  }
  el.cpList.innerHTML = html;
}

function shStamp(ts) {
  const d = new Date(Number(ts) || Date.now());
  const now = new Date();
  const same = d.toDateString() === now.toDateString();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return same ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : d.getMonth() + 1 + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function renderShareHist(items, title) {
  el.shTitle.textContent = title;
  if (!items.length) {
    el.shList.innerHTML = '';
    el.shEmpty.classList.remove('hidden');
    return;
  }
  el.shEmpty.classList.add('hidden');
  el.shList.innerHTML = items
    .map((it) => {
      const out = it.dir === 'out';
      const who = it.peer ? it.peer.nick || it.peer.username : '?';
      const kind = it.item && it.item.kind === 'todo' ? '待办' : '备忘录';
      return (
        '<div class="sh-row">' +
        '<i class="sh-dir' + (out ? ' out' : ' inn') + '">' + (out ? '↗' : '↙') + '</i>' +
        '<span class="sh-main"><b>' + esc(who) + '</b><em>' + (out ? '你咻给 TA' : 'TA 咻给你') + ' · ' + kind + '</em>' +
        '<span class="sh-text">' + esc((it.item && it.item.text) || '（空）') + '</span></span>' +
        '<span class="sh-time">' + shStamp(it.createdAt) + '</span>' +
        '</div>'
      );
    })
    .join('');
}

async function openShareHist(peerId, peerName) {
  if (!S.account.signedIn) {
    toast('先在设置里登录，才能看到咻记录');
    return;
  }
  const r = await api.account.shareHistory();
  if (!r || !r.ok) {
    toast('拉咻记录失败：' + ((r && r.message) || '未知原因'), true);
    return;
  }
  const all = Array.isArray(r.items) ? r.items : [];
  const list = peerId ? all.filter((x) => x.peer && x.peer.id === peerId) : all;
  renderShareHist(list, peerId ? '和 ' + (peerName || '好友') + ' 的咻记录' : '全部咻记录');
  const rect = (peerId ? el.cpList : el.cpMore).getBoundingClientRect();
  el.shareHist.classList.remove('hidden');
  const w = el.shareHist.offsetWidth;
  const h = el.shareHist.offsetHeight;
  let left = Math.min(Math.max(8, rect.left), window.innerWidth - w - 10);
  let top = rect.bottom + 6;
  if (top + h > window.innerHeight - 10) top = Math.max(8, rect.top - h - 6);
  el.shareHist.style.left = Math.round(left) + 'px';
  el.shareHist.style.top = Math.round(top) + 'px';
  nudgeRect(900);
}

function closeShareHist() {
  if (el.shareHist) el.shareHist.classList.add('hidden');
}

function closeSharePop() {`);

fs.writeFileSync(p, s);
console.log("app ok", s.length);