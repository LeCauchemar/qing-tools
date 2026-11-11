(() => {
  const h = document.querySelector('[data-tool-toggle="dev"]');
  const before = [...document.querySelectorAll('.tool-card.open')].map((c) => c.dataset.tool);
  h.click();
  const after = [...document.querySelectorAll('.tool-card.open')].map((c) => c.dataset.tool);
  return JSON.stringify({
    before,
    after,
    acts: document.querySelectorAll('#dvActs [data-dv-act]').length,
    dvTab: typeof S !== 'undefined' ? S.dvTab : 'no S',
    toolsOpen: typeof S !== 'undefined' ? S.toolsOpen : 'no S',
    inHtml: document.querySelector('#dvIn') ? true : false,
  });
})()