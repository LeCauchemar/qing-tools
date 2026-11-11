/**
 * 把短信内容 POST 给桌面 Qing Tools（和安卓 APK 走同一个接口）
 */
import { http } from '@kit.NetworkKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { Cfg } from './Config';

export interface SendResult {
  ok: boolean;
  msg: string;
  code: string;
}

/** 拼最终的请求地址：<url>?token=xxx */
function buildUrl(url: string, token: string): string {
  const sep: string = url.indexOf('?') >= 0 ? '&' : '?';
  return url + sep + 'token=' + encodeURIComponent(token);
}

export async function send(cfg: Cfg, from: string, text: string): Promise<SendResult> {
  if (!cfg.url || cfg.url.length === 0) {
    return { ok: false, msg: '还没填接口地址', code: '' };
  }
  if (!cfg.token || cfg.token.length === 0) {
    return { ok: false, msg: '还没填密钥', code: '' };
  }
  const req = http.createHttp();
  try {
    const body: string = JSON.stringify({
      from: from,
      text: text,
      src: 'harmony'
    });
    const res = await req.request(buildUrl(cfg.url, cfg.token), {
      method: http.RequestMethod.POST,
      header: { 'Content-Type': 'application/json; charset=utf-8' },
      extraData: body,
      connectTimeout: 8000,
      readTimeout: 8000,
      expectDataType: http.HttpDataType.STRING
    });
    const raw: string = typeof res.result === 'string' ? res.result : '';
    if (res.responseCode !== 200) {
      return { ok: false, msg: '服务器返回 HTTP ' + res.responseCode, code: '' };
    }
    let code: string = '';
    try {
      const obj = JSON.parse(raw) as Record<string, Object>;
      const c = obj['code'];
      if (typeof c === 'string') {
        code = c;
      }
    } catch (e) {
      // 服务器返回的不是 JSON，就当成功但没抽到码
    }
    return { ok: true, msg: code.length > 0 ? '已发送，验证码 ' + code : '已发送（没抽到验证码）', code: code };
  } catch (e) {
    const err = e as BusinessError;
    return { ok: false, msg: '发送失败：' + (err.message ?? '未知错误'), code: '' };
  } finally {
    req.destroy();
  }
}
