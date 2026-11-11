(async () => {
  applyStyle('island');
  applyTheme('light');
  setPinned(false);
  setMode('idle');
  await new Promise((r) => setTimeout(r, 400));
  const room = S.chat.rooms[0];
  chatReact(room, { kind: 'nudge', deviceId: 'peerX', deviceName: 'peer-nudger', mentions: [room.deviceId] });
  await new Promise((r) => setTimeout(r, 150));
  const isl = document.getElementById('island');
  const cs = getComputedStyle(isl);
  return JSON.stringify({
    mode: S.mode,
    shake: isl.classList.contains('shake'),
    anim: cs.animationName + ' / ' + cs.animationDuration,
    rainbowPeek: document.getElementById('stage').classList.contains('rainbow-peek'),
    title: document.getElementById('peekTitle').textContent,
    sub: document.getElementById('peekSub').textContent,
    titleColor: getComputedStyle(document.getElementById('peekTitle')).color
  });
})()
