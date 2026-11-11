(async () => {
  const out = {};
  out.version = S.data.meta.version;
  out.cloud = await api.app.cloud();

  // 缩略图渲染：伪造一条带 thumb 的消息，只调纯函数看 HTML
  const html = chatMsgHtml({
    id: 'x1', kind: 'image', deviceName: 'test', at: Date.now(),
    url: 'http://qing-tools.test.upcdn.net/island/chat/r1/a.png',
    thumb: 'http://qing-tools.test.upcdn.net/island/chat/r1/a.png!default'
  });
  out.smallImg = /src="([^"]+)"/.exec(html)[1];
  out.bigImg = /data-img="([^"]+)"/.exec(html)[1];

  // 文件上传到云（用一个真实存在的小文件）
  const add = await api.files.add(['D:\\deepseek harness daily\\dynamic-island\\build\\icon-256.png']);
  const list = S.data.files;
  const one = list.find((f) => /icon-256/.test(f.name));
  out.staged = !!add.ok && !!one;
  if (one) {
    const up = await api.files.uploadCloud(one.id);
    out.upload = { ok: up.ok, url: up.url, message: up.message };
  }
  out.cloudLine = (document.querySelector('#cloudSub') || {}).textContent;
  return JSON.stringify(out, null, 1);
})()
