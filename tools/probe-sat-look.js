(async () => {
  applyStyle('island'); applyTheme('light'); setPinned(false);
  S.data.mail.unseen = 3;
  S.chat.rooms[0].unread = 2;
  renderBadges();
  setMode('idle');
  await new Promise((r) => setTimeout(r, 900));
  return JSON.stringify({ satMail: document.getElementById('satMail').className, num: document.getElementById('satMailNum').textContent, chatNum: document.getElementById('satChatNum').textContent, chatCls: document.getElementById('satChat').className });
})()
