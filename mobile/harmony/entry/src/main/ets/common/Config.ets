/**
 * 配置与验证码抽取（纯逻辑，可被页面、通知订阅、服务卡片共用）
 */
import { preferences } from '@kit.ArkData';
import { common } from '@kit.AbilityKit';

export const STORE = 'qingtools_sms';
export const DEF_URL: string = 'https://chat.ccyyqq.com/island/api/hook/sms';

export interface Cfg {
  url: string;
  token: string;
  all: boolean;
}

const HINT = new RegExp(
  '验证码|校验码|动态码|确认码|激活码|口令|一次性代码|一次性密码|verification|code|passcode|otp',
  'i'
);

/** 去掉零宽字符、把被拆开的数字粘回去：「24 03 01」→「240301」 */
export function squeeze(text: string): string {
  if (!text) {
    return '';
  }
  let s: string = text.replace(/[\u200b-\u200d\ufeff]/g, '');
  s = s.replace(/(\d)[\s\u00a0]+(?=\d)/g, '$1');
  return s;
}

/** 这条短信该不该转发（用户勾了「全部」就都转发） */
export function shouldForward(text: string, all: boolean): boolean {
  if (!text || text.trim().length === 0) {
    return false;
  }
  return all || HINT.test(text);
}

/** 抽 4~8 位验证码，抽不到返回空串 */
export function extractCode(text: string): string {
  const src: string = squeeze(text);
  // 每次新建 RegExp：模块级带 /g 的正则会被 lastIndex 污染
  const re = new RegExp(
    '(验证码|校验码|动态码|确认码|激活码|口令|一次性代码|一次性密码|verification\\s*code|security\\s*code|one-?time\\s*(code|password)|otp|passcode)[^0-9]{0,16}((\\d[\\s\\u00a0]?){4,8})',
    'gi'
  );
  let m: RegExpExecArray | null = re.exec(src);
  while (m !== null) {
    const digits: string = (m[2] ?? '').replace(/[^\d]/g, '');
    if (digits.length >= 4 && digits.length <= 8) {
      return digits;
    }
    m = re.exec(src);
  }
  // 兜底：全文只有一个 6 位数，且前后 40 字里有「代码/验证/密码」之类的提示词
  const hits: string[] = src.match(/\d{6}/g) ?? [];
  const sixOnly: string[] = hits.filter((v: string, i: number) => {
    const idx: number = src.indexOf(v);
    const before: string = idx > 0 ? src.substring(idx - 1, idx) : '';
    const after: string = src.substring(idx + 6, idx + 7);
    return (before === '' || !/\d/.test(before)) && (after === '' || !/\d/.test(after)) && hits.indexOf(v) === i;
  });
  if (sixOnly.length === 1) {
    const idx: number = src.indexOf(sixOnly[0]);
    const from: number = Math.max(0, idx - 40);
    const around: string = src.substring(from, Math.min(src.length, idx + 46));
    if (/(代码|密码|口令|验证|校验|激活|code|passcode|otp|pin)/i.test(around)) {
      return sixOnly[0];
    }
  }
  return '';
}

/** 读配置（首次调用时用默认值） */
export async function loadCfg(ctx: common.Context): Promise<Cfg> {
  const store = await preferences.getPreferences(ctx, STORE);
  const cfg: Cfg = {
    url: (await store.get('url', DEF_URL)) as string,
    token: (await store.get('token', '')) as string,
    all: (await store.get('all', false)) as boolean
  };
  if (!cfg.url || cfg.url.length === 0) {
    cfg.url = DEF_URL;
  }
  return cfg;
}

export async function saveCfg(ctx: common.Context, cfg: Cfg): Promise<void> {
  const store = await preferences.getPreferences(ctx, STORE);
  await store.put('url', cfg.url);
  await store.put('token', cfg.token);
  await store.put('all', cfg.all);
  await store.flush();
}

/** 从「整段配置文字」里抠出地址和密钥（和安卓端同一套规则） */
export interface Parsed {
  url: string;
  token: string;
}

export function parseConfig(raw: string): Parsed {
  const out: Parsed = { url: '', token: '' };
  if (!raw) {
    return out;
  }
  const mu = raw.match(/https?:\/\/[^\s"'<>]*\/(?:api\/)?(?:hook\/sms|sms)/);
  if (mu !== null) {
    out.url = mu[0];
  }
  const mt = raw.match(/token=([A-Za-z0-9_-]{8,})/);
  if (mt !== null) {
    out.token = mt[1];
  } else {
    const mk = raw.match(/(?:密钥|key|secret)\s*[:：]?\s*([A-Za-z0-9_-]{8,})/i);
    if (mk !== null) {
      out.token = mk[1];
    } else {
      const bare = raw.trim();
      if (/^[A-Za-z0-9_-]{12,}$/.test(bare)) {
        out.token = bare;
      }
    }
  }
  return out;
}
