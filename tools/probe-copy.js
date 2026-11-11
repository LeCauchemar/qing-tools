(async () => {
  const r = curRoom();
  if (!r) return { err: 'no room' };
  setTab('chat');
  setMode('panel');
  setPinned(true);
  await new Promise((x) => setTimeout(x, 700));
  const first = [...document.querySelectorAll('#chatMsgs .msg .bub')].find((b) => !b.classList.contains('img') && b.textContent.trim());
  if (!first) return { err: 'no text bubble' };
  const range = document.createRange();
  range.selectNodeContents(first);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  return {
    room: r.name,
    msgs: r.messages.length,
    selected: String(sel).slice(0, 40),
    chatSel: chatSelection().slice(0, 40),
    selectable: getComputedStyle(first).userSelect,
    bubbleText: first.textContent.slice(0, 50),
  };
})()