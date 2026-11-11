(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  S.grace = Date.now() + 600000;
  openPanel('clipboard', true);
  await wait(400);

  const before = S.data.clips.length;
  const rows = document.querySelectorAll('#clipList .row');
  let target = null;
  for (const r of rows) {
    if (r.textContent.includes('github.com')) {
      target = r;
      break;
    }
  }
  if (!target) return 'no github row';
  target.click();
  await wait(1600);
  return JSON.stringify({
    before,
    after: S.data.clips.length,
    top: (S.data.clips[0] || {}).text,
    first: (S.data.clips[S.data.clips.length - 1] || {}).text
  });
})();
