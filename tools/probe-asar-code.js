// 用「已安装的 asar」里的 mail-text.js 复现验证码抽取，排查线上为什么抽不到
const asar = require('@electron/asar');
const fs = require('node:fs');
const path = require('node:path');

const asarPath = path.join(process.env.LOCALAPPDATA, 'Programs', 'dynamic-island', 'resources', 'app.asar');
const code = asar.extractFile(asarPath, 'src\\main\\mail-text.js').toString('utf8');
const tmp = path.join(__dirname, '..', '.tmp-mail-text.js');
fs.writeFileSync(tmp, code);
const mt = require(tmp);

const text = [
  '296904016@qq.com，你好!',
  '',
  '我们已收到你要求获得 Microsoft 帐户所用的一次性代码的申请。',
  '',
  '你的一次性代码为: 240301',
  '',
  '仅在官方网站或应用上输入此代码。不要与任何人共享。我们绝不会在官方平台之外索要它。',
  '',
  '谢谢，',
  'Microsoft 帐户团队',
  '隐私声明: https://go.microsoft.com/fwlink/?LinkId=52183'
].join('\r\n');

console.log('asar path:', asarPath);
console.log('has squeezeDigits:', code.includes('squeezeDigits'));
console.log('extract:', JSON.stringify(mt.extractCode(text)));
console.log('analyze:', JSON.stringify(mt.analyze(text, { isHtml: false }).code));
fs.unlinkSync(tmp);
