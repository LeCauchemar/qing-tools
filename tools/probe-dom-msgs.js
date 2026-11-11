(() => {
  const out = [];
  document.querySelectorAll('#chatMsgs .msg').forEach((m) => {
    const b = m.querySelector('.bub');
    out.push({ cls: m.className, bcls: b ? b.className : '', who: (m.querySelector('.who') || {}).textContent || '', head: (b ? b.textContent : '').slice(0, 40) });
  });
  return JSON.stringify(out.slice(-6));
})()
