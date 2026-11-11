// 系统状态采样：CPU / 内存 / 网速 / 电量
// 全部走异步 + 缓存，别在指针轮询那种地方同步调用
const os = require('node:os');
const { execFile } = require('node:child_process');

let prevCpu = null;
let prevNet = null; // { at, rx, tx }

let netAt = 0;
let netCur = null; // { rx, tx }
let netPending = false;

let batAt = 0;
let batVal = null; // { pct, charging } | null
let batPending = false;

function runPs(cmd, timeout = 4000) {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', cmd],
      { windowsHide: true, timeout, maxBuffer: 1 << 20 },
      (err, stdout) => resolve(err ? '' : String(stdout || ''))
    );
  });
}

function cpuTimes() {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus()) {
    for (const k of Object.keys(c.times)) total += c.times[k];
    idle += c.times.idle;
  }
  return { idle, total };
}

function cpuPercent() {
  const cur = cpuTimes();
  if (!prevCpu) {
    prevCpu = cur;
    return 0;
  }
  const dTotal = cur.total - prevCpu.total;
  const dIdle = cur.idle - prevCpu.idle;
  prevCpu = cur;
  if (dTotal <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - dIdle / dTotal) * 100)));
}

// netstat -e 里那两行累计字节，做差分就是实时速率
async function sampleNet() {
  if (netPending || Date.now() - netAt < 1200) return;
  netPending = true;
  try {
    const out = await runPs('netstat -e');
    const m = out.match(/^\s*Bytes\s+(\d+)\s+(\d+)/im);
    if (m) {
      const rx = Number(m[1]);
      const tx = Number(m[2]);
      const now = Date.now();
      if (prevNet && now - prevNet.at > 200) {
        const dt = (now - prevNet.at) / 1000;
        netCur = {
          rx: Math.max(0, Math.round((rx - prevNet.rx) / dt)),
          tx: Math.max(0, Math.round((tx - prevNet.tx) / dt))
        };
      } else if (!netCur) {
        netCur = { rx: 0, tx: 0 };
      }
      prevNet = { at: now, rx, tx };
    }
    netAt = Date.now();
  } finally {
    netPending = false;
  }
}

async function sampleBattery() {
  if (batPending || Date.now() - batAt < 20000) return;
  batPending = true;
  try {
    const out = await runPs(
      'Get-CimInstance Win32_Battery | Select-Object -First 1 EstimatedChargeRemaining,BatteryStatus | ConvertTo-Json -Compress'
    );
    const t = out.trim();
    if (t) {
      const o = JSON.parse(t);
      const pct = Number(o.EstimatedChargeRemaining);
      batVal = Number.isFinite(pct) ? { pct, charging: Number(o.BatteryStatus) === 2 } : null;
    } else {
      batVal = null; // 台式机没有电池
    }
    batAt = Date.now();
  } catch (_) {
    batVal = null;
  } finally {
    batPending = false;
  }
}

function formatBytes(n) {
  if (!n) return '0 B/s';
  const u = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return (v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)) + ' ' + u[i];
}

async function stat() {
  sampleNet();
  sampleBattery();
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    cpu: cpuPercent(),
    mem: {
      total,
      used,
      free,
      pct: Math.round((used / total) * 100)
    },
    net: netCur || { rx: 0, tx: 0 },
    netText: netCur ? formatBytes(netCur.rx) : '—',
    battery: batVal,
    up: Math.round(os.uptime()),
    cpus: os.cpus().length,
    text: { mem: (used / 1024 ** 3).toFixed(1) + ' / ' + (total / 1024 ** 3).toFixed(0) + ' GB' }
  };
}

module.exports = { stat, formatBytes };
