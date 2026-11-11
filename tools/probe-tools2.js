(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};

  // 打开开发小工具卡片
  const head = document.querySelector('[data-tool-toggle="dev"]');
  if (!document.querySelector('.tool-card[data-tool="dev"]').classList.contains('open')) head.click();
  await wait(350);
  out.open = [...document.querySelectorAll('.tool-card.open')].map((c) => c.dataset.tool);
  out.tabs = [...document.querySelectorAll('#dvTabs .dv-tab')].map((b) => b.textContent);

  // UUID
  document.querySelector('[data-dv="uuid"]').click();
  await wait(120);
  out.uuidActs = [...document.querySelectorAll('#dvActs [data-dv-act]')].map((b) => b.textContent);
  document.querySelector('[data-dv-act="uuid5"]').click();
  await wait(150);
  out.uuids = (document.querySelector('#dvOut').value || '').split('\n').filter(Boolean);

  // SHA-256
  document.querySelector('[data-dv="hash"]').click();
  document.querySelector('#dvIn').value = 'hello';
  document.querySelector('[data-dv-act="sha256"]').click();
  await wait(250);
  out.sha256 = (document.querySelector('#dvOut').value || '').slice(0, 20);

  // Base64 往返（含中文）
  document.querySelector('[data-dv="b64"]').click();
  document.querySelector('#dvIn').value = 'Qing Tools 你好';
  document.querySelector('[data-dv-act="b64enc"]').click();
  await wait(120);
  const b64 = document.querySelector('#dvOut').value;
  document.querySelector('#dvIn').value = b64;
  document.querySelector('[data-dv-act="b64dec"]').click();
  await wait(120);
  out.b64 = { enc: b64, dec: document.querySelector('#dvOut').value };

  // 时间戳
  document.querySelector('[data-dv="ts"]').click();
  document.querySelector('#dvIn').value = '1731000000';
  document.querySelector('[data-dv-act="ts2date"]').click();
  await wait(120);
  out.ts2date = document.querySelector('#dvOut').value;
  document.querySelector('[data-dv-act="date2ts"]').click();
  await wait(120);
  out.date2ts = (document.querySelector('#dvOut').value || '').split('\n');

  // 系统条
  document.querySelector('[data-tool-toggle="sys"]').click();
  await wait(1600);
  out.sysOpen = [...document.querySelectorAll('.tool-card.open')].map((c) => c.dataset.tool);
  out.sysRows = [...document.querySelectorAll('#sysRows .sb-item')].map((r) => r.textContent.replace(/\s+/g, ' ').trim());
  out.sysMeta = (document.querySelector('#sysRows .sys-meta') || {}).textContent;
  out.sysSub = document.querySelector('#sysSub').textContent;

  // 天气
  out.wxSub = document.querySelector('#wxSub').textContent;
  out.wx = S.wx;
  out.idleSub = document.querySelector('#idleSub').textContent;

  return out;
})()