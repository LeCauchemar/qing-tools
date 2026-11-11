(async () => {
  S.grace = Date.now() + 600000;
  setPinned(true);
  setTab('settings');
  applyProvider('outlook', false);
  document.querySelector('#msClientId').value = '04f0c124-f2bc-4f59-8241-bf6df9866bbd';
  document.querySelector('#msLogin').click();
  await new Promise((r) => setTimeout(r, 2500));
  const box = document.querySelector('#msOauthBox');
  box.scrollIntoView({ block: 'center' });
  return JSON.stringify({
    codeVisible: !document.querySelector('#msCode').classList.contains('hidden'),
    code: document.querySelector('#msCodeVal').textContent.trim(),
    state: document.querySelector('#msCodeState').textContent.trim(),
    toast: document.querySelector('#toast').textContent.trim()
  });
})()
