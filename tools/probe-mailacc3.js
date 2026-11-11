(async () => {
  applyStyle('island'); applyTheme('dark'); setPinned(true); S.grace = Date.now() + 600000;
  S.data.mail.accounts = [
    { id: 'a1', label: 'QQ 邮箱', user: 'chenyuqing@qq.com', host: 'imap.qq.com', port: 993, secure: true, auth: 'pass', total: 31, unseen: 4, mode: 'idle', error: '' },
    { id: 'a2', label: '工作邮箱', user: 'work@company.com', host: 'imap.exmail.qq.com', port: 993, secure: true, auth: 'pass', total: 88, unseen: 2, mode: 'poll', error: '' }
  ];
  setTab('mail'); setMode('panel'); renderMail();
  await new Promise(r=>setTimeout(r,900));
  renderMail();
  return JSON.stringify({ chips: document.querySelectorAll('.mf-chip').length, first: (document.querySelector('.mf-chip')||{}).textContent });
})()
