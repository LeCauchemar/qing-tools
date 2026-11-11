new Promise(async (r) => {
  S.grace = Date.now() + 900000;
  setMode('idle');
  const room = curRoom();
  setDnd(30);
  await new Promise((x) => setTimeout(x, 300));
  r(
    JSON.stringify({
      code: room && room.code,
      state: room && room.state,
      dnd: isDnd(),
      dndText: el.dndState && el.dndState.textContent,
      unread: room && room.unread,
      mode: S.mode
    })
  );
});
