import fs from 'node:fs';

const files = ['site/index.html', 'site/iphone.html', 'site/android.html', 'README.md'];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const before = fs.readFileSync(f, 'utf8');
  const after = before
    .split('1.10.3-setup.exe').join('1.10.4-setup.exe')
    .split('1.10.3-portable.exe').join('1.10.4-portable.exe')
    .split('v1.10.3').join('v1.10.4')
    .split('1.10.3').join('1.10.4');
  if (after !== before) {
    fs.writeFileSync(f, after);
    console.log('updated', f);
  }
}

const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = '1.10.4';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('version', pkg.version);
