(async () => {
  const before = (S.data.files || []).length;
  const btn = document.querySelector('#fsMenu [data-fs-act="stash"]');
  btn.click();
  await new Promise(r=>setTimeout(r,1500));
  const after = (S.data.files || []).length;
  const toastEl = document.getElementById('toast');
  return JSON.stringify({ before, after, selAfter: S.fs.sel.size, toast: toastEl && toastEl.textContent, tab: S.tab });
})()
