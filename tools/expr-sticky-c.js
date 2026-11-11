(() => {
  const n = (S.data.notes || []).find(x => x.id === 'note_mwaetolh_3');
  return JSON.stringify({ note: n, html: document.getElementById('note').innerHTML.slice(0, 200) });
})()
