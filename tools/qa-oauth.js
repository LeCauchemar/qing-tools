(() => {
  S.grace = Date.now() + 600000;
  setPinned(true);
  setTab('settings');
  applyProvider('outlook', false);
  const pane = document.querySelector('.pane[data-pane="settings"]');
  const sc = pane.querySelector('.pane-scroll') || pane;
  sc.scrollTop = sc.scrollHeight;
  const box = document.querySelector('#msOauthBox');
  box.scrollIntoView({ block: 'center' });
  document.querySelector('#msGuide').classList.remove('hidden');
  return JSON.stringify({
    tab: S.tab,
    boxTop: Math.round(box.getBoundingClientRect().top),
    boxH: Math.round(box.getBoundingClientRect().height),
    guideOpen: !document.querySelector('#msGuide').classList.contains('hidden')
  });
})()
