(async () => {
  S.data.mail.accounts = [
    { id: 'a1', label: 'QQ 邮箱', user: 'chenyuqing@qq.com', host: 'imap.qq.com', port: 993, secure: true, auth: 'pass', total: 31, unseen: 4, mode: 'idle', error: '' },
    { id: 'a2', label: '工作邮箱', user: 'work@company.com', host: 'imap.exmail.qq.com', port: 993, secure: true, auth: 'pass', total: 88, unseen: 2, mode: 'poll', error: '' }
  ];
  renderMail();
  const n = document.querySelectorAll('.mf-chip').length;
  return JSON.stringify({ chips: n, html: document.getElementById('mailFilters').className });
})()
