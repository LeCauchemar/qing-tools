// 校验 asar 里的关键改动是否都在（路径要用反斜杠，@electron/asar 在 Windows 上如此）
const a = require('@electron/asar');
const f = 'dist/win-unpacked/resources/app.asar';
const pkg = JSON.parse(a.extractFile(f, 'package.json').toString('utf8'));
const app = a.extractFile(f, 'src\\renderer\\app.js').toString('utf8');
const html = a.extractFile(f, 'src\\renderer\\index.html').toString('utf8');
const css = a.extractFile(f, 'src\\renderer\\styles.css').toString('utf8');
const count = (s, k) => s.split(k).length - 1;
console.log(JSON.stringify({
  version: pkg.version,
  smsCopy: count(app, 'smsCopy'),
  devicePaste: count(app, 'device-paste'),
  lastIdSkip: count(app, 'm.id <= last'),
  transposed: count(app, 'transposed'),
  allSwitch: count(app, 'sms-all'),
  tokenHint: count(html, '密钥填错了'),
  cssSdAct: count(css, '.sd-act'),
  cssTransposed: count(css, 'transposed'),
}, null, 2));
