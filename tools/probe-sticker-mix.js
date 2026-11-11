(async () => {
  const room = curRoom();
  if (!room) return 'no-room';
  if (!room.stickers || !room.stickers.length) {
    // 造一张小图，走真实上传接口
    const cv = document.createElement('canvas'); cv.width = 96; cv.height = 96;
    const g = cv.getContext('2d');
    g.fillStyle = '#ff5fa2'; g.fillRect(0, 0, 96, 96);
    g.fillStyle = '#fff'; g.font = 'bold 46px sans-serif'; g.fillText('喵', 18, 66);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const up = await fetch(CHAT_API + '/api/upload', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: await blob.arrayBuffer() });
    const d = await up.json();
    await chatAddSticker(d.mediaId || d.id, '喵');
  }
  setMode('panel'); setTab('chat');
  await new Promise((r) => setTimeout(r, 700));
  chatToggleEmoji(true);
  S.emojiTab = 'sticker'; renderEmojiPop();
  const cell = document.querySelector('[data-sticker]');
  if (!cell) return JSON.stringify({ err: 'no-cell', stickers: (room.stickers || []).length });
  cell.click();
  await new Promise((r) => setTimeout(r, 200));
  el.chatInput.value = '晚上一起吃饭吗';
  const before = { pending: S.chat.pending.length, barHidden: el.pendingBar.classList.contains('hidden'), items: el.pendingBar.querySelectorAll('.p-item').length };
  const ok = chatSendText();
  await new Promise((r) => setTimeout(r, 1500));
  const last = curRoom().messages[curRoom().messages.length - 1];
  const bub = el.chatMsgs.lastElementChild.querySelector('.bub');
  return JSON.stringify({
    before, sent: ok,
    lastKind: last && last.kind, lastText: last && last.text,
    pendingAfter: S.chat.pending.length,
    barHiddenAfter: el.pendingBar.classList.contains('hidden'),
    bubbleClass: bub && bub.className,
    inlineImgs: el.chatMsgs.querySelectorAll('img.inl').length,
    inlW: el.chatMsgs.querySelector('img.inl') ? el.chatMsgs.querySelector('img.inl').getBoundingClientRect().width : 0
  });
})()
