(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(3500);
  out.sys = {
    hidden: document.querySelector('#satSys').classList.contains('hidden'),
    val: document.querySelector('#sysVal').textContent,
    title: document.querySelector('#satSys').title
  };
  out.mail = {
    hidden: document.querySelector('#satMail').classList.contains('hidden'),
    num: document.querySelector('#satMailNum').textContent
  };
  out.chat = {
    hidden: document.querySelector('#satChat').classList.contains('hidden'),
    num: document.querySelector('#satChatNum').textContent
  };
  const isl = document.querySelector('#island').getBoundingClientRect();
  const rect = unionRect();
  out.rect = {
    islandW: Math.round(isl.width),
    unionW: Math.round(rect.width),
    unionX: Math.round(rect.x),
    islandX: Math.round(isl.x)
  };
  // 表情面板 tab 切换是否保持打开
  openPanel('chat');
  await sleep(700);
  chatToggleEmoji(true);
  await sleep(300);
  const pop = document.querySelector('#emojiPop');
  out.popBefore = !pop.classList.contains('hidden');
  const tabBtn = pop.querySelector('[data-emoji-tab="sticker"]');
  tabBtn.click();
  await sleep(300);
  out.popAfter = !pop.classList.contains('hidden');
  out.activeTab = (pop.querySelector('.emoji-tab.active') || {}).textContent;
  out.mode = S.mode;
  return JSON.stringify(out);
})();
