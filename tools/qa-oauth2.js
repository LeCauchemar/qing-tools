(async () => {
  const before = {
    guide: !document.querySelector('#msGuide').classList.contains('hidden')
  };
  document.querySelector('#msClientId').value = '';
  document.querySelector('#msLogin').click();
  await new Promise((r) => setTimeout(r, 700));
  return JSON.stringify({
    before,
    afterGuide: !document.querySelector('#msGuide').classList.contains('hidden'),
    toast: document.querySelector('#toast').textContent.trim(),
    codeHidden: document.querySelector('#msCode').classList.contains('hidden')
  });
})()
