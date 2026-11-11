(async () => {
  const room = curRoom();
  const st = (room.stickers || [])[0];
  if (!st) return 'no-sticker';
  chatSendSticker({ mediaId: st.mediaId || st.id, url: st.url, thumb: st.thumb });
  await new Promise((r) => setTimeout(r, 150));
  el.chatInput.value = '这周的会改到周四';
  const marks = S.chat.pending.length;
  chatSendText();
  await new Promise((r) => setTimeout(r, 1400));
  const last = room.messages[room.messages.length - 1];
  const bub = document.querySelector('#chatMsgs .msg:last-child .bub');
  const img = bub && bub.querySelector('img.inl');
  return JSON.stringify({
    marks, text: last && last.text,
    bubble: bub && bub.className,
    imgSrc: img ? img.src.slice(-46) : '',
    missing: !!(bub && bub.querySelector('.inl-missing'))
  });
})()
