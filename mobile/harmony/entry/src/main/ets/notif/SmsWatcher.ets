/**
 * 路线 B：订阅通知，命中短信 + 验证码关键词就自动转发。
 *
 * 需要的权限：ohos.permission.NOTIFICATION_CONTROLLER（受限权限，必须在 AGC 申请到 ACL）。
 * 没有 ACL 时 subscribe() 会失败（201），此时返回 false，页面会提示改用「复制 → 一键发送」。
 */
import { notificationManager } from '@kit.NotificationKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { Cfg, extractCode, shouldForward } from '../common/Config';
import { send } from '../common/Forward';

let started: boolean = false;
let listening: boolean = false;
let cfgRef: Cfg | null = null;
let subscriberRef: notificationManager.NotificationSubscriber | null = null;
let logRef: (s: string) => void = (s: string) => {};

export function isStarted(): boolean {
  return started;
}

/** 短信类应用的包名：鸿蒙自带短信为 com.ohos.mms，部分定制机不同，这里用宽松匹配 */
function looksLikeSms(bundle: string): boolean {
  const b: string = (bundle ?? '').toLowerCase();
  return b.indexOf('mms') >= 0 || b.indexOf('sms') >= 0 || b.indexOf('message') >= 0;
}

async function handle(request: notificationManager.NotificationRequest): Promise<void> {
  try {
    if (cfgRef === null) {
      return;
    }
    const bundle: string = request.bundle ?? '';
    if (!looksLikeSms(bundle)) {
      return;
    }
    const normal = request.content.normal;
    const title: string = (normal?.title as string) ?? '';
    const text: string = (normal?.text as string) ?? '';
    const extra = request.content.longText;
    const longText: string = (extra?.text as string) ?? '';
    const body: string = (text + '\n' + longText).trim();
    if (!shouldForward(body, cfgRef.all)) {
      return;
    }
    const code: string = extractCode(body);
    if (!cfgRef.all && code.length === 0) {
      return;
    }
    const r = await send(cfgRef, title.length > 0 ? title : '短信', body);
    logRef(r.msg);
  } catch (e) {
    // 通知内容读取失败（字段缺失等）时静默跳过，不影响下一条
  }
}

export async function start(cfg: Cfg, log: (s: string) => void): Promise<boolean> {
  cfgRef = cfg;
  logRef = log;
  if (started) {
    return true;
  }
  const subscriber: notificationManager.NotificationSubscriber = {
    onConsume: (request: notificationManager.NotificationRequest) => {
      handle(request);
    },
    onCancel: () => {
    },
    onUpdate: () => {
    },
    onConnect: () => {
      listening = true;
    },
    onDisconnect: () => {
      listening = false;
    }
  };
  try {
    await notificationManager.subscribe(subscriber);
    subscriberRef = subscriber;
    started = true;
    log('已开始监听通知');
    return true;
  } catch (e) {
    const err = e as BusinessError;
    log('订阅通知失败（' + (err.code ?? 0) + '）：多半没有 NOTIFICATION_CONTROLLER 的 ACL，改用「发送剪贴板」');
    return false;
  }
}

export function updateCfg(cfg: Cfg): void {
  cfgRef = cfg;
}

export async function stop(): Promise<void> {
  if (!started || subscriberRef === null) {
    return;
  }
  try {
    await notificationManager.unsubscribe(subscriberRef);
  } catch (e) {
    // 忽略
  }
  subscriberRef = null;
  started = false;
  listening = false;
}
