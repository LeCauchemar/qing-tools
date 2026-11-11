(async () => {
  const isl = document.getElementById('island');
  isl.style.removeProperty('--isl-r');
  location.reload();
  return 'cleaned';
})()
