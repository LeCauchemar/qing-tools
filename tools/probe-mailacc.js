(async () => {
  const added = (S.data.files || []).slice(0, 9).map(f => f.id);
  for (const id of added) await api.files.remove(id);
  await new Promise(r=>setTimeout(r,600));
  // 注入第二个假账户，只看渲染效果（不保存）
  const m = S.data.mail;
  S.data.mail.accounts = [
    { id: 'a1', label: 'QQ 邮箱', user: 'chenyuqing@qq.com', host: 'imap.qq.com', port: 993, secure: true, auth: 'pass', total: 31, unseen: 4, mode: 'idle', error: '' },
    { id: 'a2', label: '工作邮箱', user: 'work@company.com', host: 'imap.exmail.qq.com', port: 993, secure: true, auth: 'pass', total: 88, unseen: 2, mode: 'poll', error: '' }
  ];
  S.data.mail.items = [
    { key: 'a1:101', accId: 'a1', accLabel: 'QQ 邮箱', subject: 'GitHub 登录验证码', fromName: 'GitHub', fromAddr: 'noreply@github.com', date: new Date(Date.now()-3600e3).toISOString(), seen: false, code: '402913' },
    { key: 'a2:202', accId: 'a2', accLabel: '工作邮箱', subject: '周会纪要（11 月）', fromName: '李经理', fromAddr: 'li@company.com', date: new Date(Date.now()-7200e3).toISOString(), seen: false },
    { key: 'a1:103', accId: 'a1', accLabel: 'QQ 邮箱', subject: '你的账单已出', fromName: '支付宝', fromAddr: 'bill@alipay.com', date: new Date(Date.now()-86400e3).toISOString(), seen: true }
  ];
  setTab('mail'); setMode('panel');
  await new Promise(r=>setTimeout(r,1200));
  return JSON.stringify({ files: (S.data.files||[]).length, filters: document.querySelectorAll('.mf-chip').length, rows: document.querySelectorAll('#mailList .row').length });
})()
