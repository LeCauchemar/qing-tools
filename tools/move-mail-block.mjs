import fs from 'node:fs';

const p = 'src/renderer/index.html';
let html = fs.readFileSync(p, 'utf8');
const before = html.length;

const mailStart = html.indexOf('                <div class="group">\n                  <div class="group-title">\n                    <span>邮箱账户</span>');
if (mailStart < 0) throw new Error('mail block start not found');
const aboutMark = '                <div class="group">\n                  <div class="group-title">关于</div>';
const aboutIdx = html.indexOf(aboutMark, mailStart);
if (aboutIdx < 0) throw new Error('about block not found');
const mailBlock = html.slice(mailStart, aboutIdx);
if (!mailBlock.includes('id="accList"')) throw new Error('mail block looks wrong');

// 从设置页摘掉整块邮箱账户
html = html.slice(0, mailStart) + html.slice(aboutIdx);

// 卡片内部：去掉外层 .group 与 group-title，只留内容
let inner = mailBlock;
inner = inner.replace(/^                <div class="group">\n/, '');
inner = inner.replace(/^                  <div class="group-title">[\s\S]*?<\/div>\n/, '');
inner = inner.replace(/\n                <\/div>\n$/, '\n');

// 检查邮件间隔：从「通用」里摘出来，放到邮件卡片最上面
const pollStart = html.indexOf('                  <label class="setting">\n                    <span class="setting-main"><b>检查邮件间隔</b>');
if (pollStart < 0) throw new Error('poll row not found');
const pollEnd = html.indexOf('                  </label>\n', pollStart) + '                  </label>\n'.length;
const pollRow = html.slice(pollStart, pollEnd).replace('class="setting"', 'class="setting flush"');
html = html.slice(0, pollStart) + html.slice(pollEnd);

const mailCard =
  '                <div class="tool-card" data-tool="mail">\n' +
  '                  <button class="tc-head" data-tool-toggle="mail">\n' +
  '                    <span class="tc-icon"><svg class="ic"><use href="#i-mail" /></svg></span>\n' +
  '                    <span class="tc-title">邮件账户</span>\n' +
  '                    <span class="tc-sum" id="mailSub">未连接</span>\n' +
  '                    <svg class="ic tc-chev"><use href="#i-chev" /></svg>\n' +
  '                  </button>\n' +
  '                  <div class="tc-body"><div class="tc-inner">\n' +
  pollRow +
  inner +
  '                  </div></div>\n' +
  '                </div>\n\n';

const sysCard = '                <div class="tool-card" data-tool="sys">';
const sysIdx = html.indexOf(sysCard);
if (sysIdx < 0) throw new Error('sys card not found');

const smsCard =
  '                <div class="tool-card" data-tool="sms">\n' +
  '                  <button class="tc-head" data-tool-toggle="sms">\n' +
  '                    <span class="tc-icon"><svg class="ic"><use href="#i-shield" /></svg></span>\n' +
  '                    <span class="tc-title">手机验证码同步</span>\n' +
  '                    <span class="tc-sum" id="smsSub">检测中…</span>\n' +
  '                    <svg class="ic tc-chev"><use href="#i-chev" /></svg>\n' +
  '                  </button>\n' +
  '                  <div class="tc-body"><div class="tc-inner">\n' +
  '                    <div class="setting flush">\n' +
  '                      <span class="setting-main"><b>短信验证码</b><i>手机收到验证码会弹到岛上，点一下就能复制</i></span>\n' +
  '                      <span class="update-actions"><button class="btn ghost small" id="smsCopy">手机端配置</button></span>\n' +
  '                    </div>\n' +
  '                    <div class="setting flush">\n' +
  '                      <span class="setting-main"><b>手机密钥</b><i>每台手机一把，只属于这台电脑：别人电脑上看不到你的手机，你也看不到别人的</i></span>\n' +
  '                      <span class="update-actions">\n' +
  '                        <input class="input sms-key" id="smsDevName" placeholder="设备名，如 小米" spellcheck="false" />\n' +
  '                        <button class="btn ghost small" id="smsDevAdd">新建密钥</button>\n' +
  '                      </span>\n' +
  '                    </div>\n' +
  '                    <div class="sms-devs" id="smsDevList"></div>\n' +
  '                    <div class="setting flush">\n' +
  '                      <span class="setting-main"><b>服务器主密钥</b><i>24 位，只在第一次绑定这台电脑时填一次；绑定后本机用自己的身份，和别人互不可见</i></span>\n' +
  '                      <span class="update-actions">\n' +
  '                        <input class="input sms-key" id="smsRead" placeholder="粘贴服务器主密钥" spellcheck="false" />\n' +
  '                        <button class="btn ghost small" id="smsReadSave">绑定</button>\n' +
  '                        <button class="btn ghost small" id="smsRebind">重新绑定</button>\n' +
  '                      </span>\n' +
  '                    </div>\n' +
  '                  </div></div>\n' +
  '                </div>\n\n';

html = html.slice(0, sysIdx) + mailCard + smsCard + html.slice(sysIdx);

fs.writeFileSync(p, html, 'utf8');
console.log('ok', before, '->', html.length);
console.log('has accList', (html.match(/id="accList"/g) || []).length);
console.log('has setPoll', (html.match(/id="setPoll"/g) || []).length);
console.log('has smsRead', (html.match(/id="smsRead"/g) || []).length);
console.log('cards', (html.match(/class="tool-card"/g) || []).length);
