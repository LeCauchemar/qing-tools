(async () => {
  const out = {};
  // 1) 卡片：数量与顺序
  out.cards = [...document.querySelectorAll('.tool-card')].map((c) => c.dataset.tool);
  // 2) 默认展开的是第一张
  out.open = [...document.querySelectorAll('.tool-card.open')].map((c) => c.dataset.tool);

  // 3) 点「开发小工具」标题：手风琴应只开它
  const devHead = document.querySelector('[data-tool-toggle="dev"]');
  devHead.click();
  await new Promise((r) => setTimeout(r, 400));
  out.openAfterDev = [...document.querySelectorAll('.tool-card.open')].map((c) => c.dataset.tool);
  out.devTabs = [...document.querySelectorAll('#dvTabs .dv-tab')].map((b) => b.textContent);
  out.devActs = [...document.querySelectorAll('#dvActs [data-dv-act]')].map((b) => b.textContent);

  // 4) UUID
  document.querySelector('[data-dv-act="uuid5"]').click();
  await new Promise((r) => setTimeout(r, 200));
  out.uuid = (document.querySelector('#dvOut').value || '').split('\n');

  // 5) 哈希
  document.querySelector('[data-dv="hash"]').click();
  document.querySelector('#dvIn').value = 'hello';
  document.querySelector('[data-dv-act="sha256"]').click();
  await new Promise((r) => setTimeout(r, 300));
  out.sha256 = (document.querySelector('#dvOut').value || '').slice(0, 16);

  // 6) Base64 往返
  document.querySelector('[data-dv="b64"]').click();
  document.querySelector('#dvIn').value = 'Qing Tools 你好';
  document.querySelector('[data-dv-act="b64enc"]').click();
  const b64 = document.querySelector('#dvOut').value;
  document.querySelector('#dvIn').value = b64;
  document.querySelector('[data-dv-act="b64dec"]').click();
  out.b64 = { enc: b64, dec: document.querySelector('#dvOut').value };

  // 7) 时间戳
  document.querySelector('[data-dv="ts"]').click();
  document.querySelector('#dvIn').value = '1731000000';
  document.querySelector('[data-dv-act="ts2date"]').click();
  out.ts = document.querySelector('#dvOut').value;

  // 8) 系统条
  await new Promise((r) => setTimeout(r, 1200));
  out.sysBars = [...document.querySelectorAll('#sysRows .sb-item')].map((r) => r.textContent.trim());
  out.sysSub = document.querySelector('#sysSub').textContent;

  // 9) 天气
  out.wxSub = document.querySelector('#wxSub').textContent;
  out.idleSub = document.querySelector('#idleSub').textContent;

  return out;
})()