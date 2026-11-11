import { common } from '@kit.AbilityKit';
import { pasteboard } from '@kit.BasicServicesKit';
import { promptAction } from '@kit.ArkUI';
import { Cfg, DEF_URL, loadCfg, saveCfg, parseConfig, extractCode, shouldForward } from '../common/Config';
import { send, SendResult } from '../common/Forward';
import * as watcher from '../notif/SmsWatcher';

@Entry
@Component
struct Index {
  @State url: string = DEF_URL;
  @State token: string = '';
  @State all: boolean = false;
  @State status: string = '先在上面填好地址和密钥，或点「从剪贴板粘贴配置」。';
  @State watching: boolean = false;
  private ctx: common.UIAbilityContext = getContext(this) as common.UIAbilityContext;

  aboutToAppear(): void {
    loadCfg(this.ctx).then((cfg: Cfg) => {
      this.url = cfg.url;
      this.token = cfg.token;
      this.all = cfg.all;
    });
    this.status = watcher.isStarted() ? '正在监听通知（全自动）' : '还没开启全自动：可以用「发送剪贴板」一键转发。';
  }

  private cfg(): Cfg {
    return { url: this.url.trim(), token: this.token.trim(), all: this.all };
  }

  private persist(): Promise<void> {
    return saveCfg(this.ctx, this.cfg());
  }

  private log(s: string): void {
    this.status = s;
  }

  private async pasteConfig(): Promise<void> {
    try {
      const sys = pasteboard.getSystemPasteboard();
      const data = await sys.getData();
      const raw: string = data.getPrimaryText() ?? '';
      if (raw.length === 0) {
        this.status = '剪贴板是空的：先在电脑上点「设置 → 短信验证码 → 手机端配置」复制那段文字。';
        return;
      }
      const p = parseConfig(raw);
      if (p.url.length > 0) {
        this.url = p.url;
      }
      if (p.token.length > 0) {
        this.token = p.token;
        this.status = '已填入地址和密钥，记得点「保存」。';
      } else {
        this.status = '没在剪贴板里找到密钥，请手动粘贴。';
      }
      await this.persist();
    } catch (e) {
      this.status = '读取剪贴板失败，请手动粘贴。';
    }
  }

  /** 路线 A：读剪贴板里的验证码/短信，直接转发 */
  private async sendClipboard(): Promise<void> {
    await this.persist();
    let text: string = '';
    try {
      const sys = pasteboard.getSystemPasteboard();
      const data = await sys.getData();
      text = data.getPrimaryText() ?? '';
    } catch (e) {
      this.status = '读取剪贴板失败。';
      return;
    }
    if (text.trim().length === 0) {
      this.status = '剪贴板是空的：先在短信里长按「拷贝验证码」，再回到这里点一次。';
      return;
    }
    const code: string = extractCode(text);
    this.status = '正在发送…';
    const r: SendResult = await send(this.cfg(), '剪贴板', text);
    if (r.ok) {
      this.status = code.length > 0 ? ('已发送，验证码 ' + code) : '已发送（剪贴板里没抽到验证码，桌面会显示原文）';
      promptAction.showToast({ message: this.status });
    } else {
      this.status = r.msg;
      promptAction.showToast({ message: r.msg });
    }
  }

  private async sendTest(): Promise<void> {
    await this.persist();
    this.status = '正在发送测试…';
    const r: SendResult = await send(this.cfg(), '测试', 'Qing Tools 测试验证码 123456');
    this.status = r.msg;
  }

  private async toggleWatch(on: boolean): Promise<void> {
    await this.persist();
    if (on) {
      const ok: boolean = await watcher.start(this.cfg(), (s: string) => {
        this.status = s;
      });
      this.watching = ok;
      if (!ok) {
        this.watching = false;
        this.status = '没有通知订阅权限（需要 ACL），先用下面的「发送剪贴板」。';
      }
    } else {
      await watcher.stop();
      this.watching = false;
      this.status = '已停止监听通知。';
    }
  }

  build() {
    Column({ space: 14 }) {
      Text('Qing Tools 短信转发')
        .fontSize(22)
        .fontWeight(FontWeight.Bold)
      Text('收到验证码 → 自动发到桌面岛，桌面会复制好并弹条。')
        .fontSize(13)
        .fontColor('#666')
        .width('100%')

      Text('接口地址').fontSize(13).fontColor('#666').width('100%')
      TextInput({ text: this.url, placeholder: DEF_URL })
        .fontSize(13)
        .onChange((v: string) => {
          this.url = v;
        })

      Text('手机密钥').fontSize(13).fontColor('#666').width('100%')
      TextInput({ text: this.token, placeholder: '在电脑上「新建密钥」后复制过来的那串' })
        .fontSize(13)
        .onChange((v: string) => {
          this.token = v;
        })

      Row({ space: 10 }) {
        Button('从剪贴板粘贴配置').layoutWeight(1).onClick(() => {
          this.pasteConfig();
        })
        Button('保存').layoutWeight(1).onClick(() => {
          this.persist().then(() => {
            this.status = '已保存。';
          });
        })
      }

      Button('发送剪贴板（收到验证码后点这个）')
        .width('100%')
        .height(46)
        .onClick(() => {
          this.sendClipboard();
        })

      Row({ space: 10 }) {
        Button('发送一条测试').layoutWeight(1).onClick(() => {
          this.sendTest();
        })
        Button('停止监听').layoutWeight(1).enabled(this.watching).onClick(() => {
          this.toggleWatch(false);
        })
      }

      Row() {
        Text('自动监听通知（需要 ACL）').fontSize(14).layoutWeight(1)
        Toggle({ type: ToggleType.Switch, isOn: this.watching })
          .onChange((on: boolean) => {
            this.toggleWatch(on);
          })
      }

      Row() {
        Text('转发所有短信（不只看验证码）').fontSize(14).layoutWeight(1)
        Toggle({ type: ToggleType.Switch, isOn: this.all })
          .onChange((on: boolean) => {
            this.all = on;
            this.persist();
          })
      }

      Text(this.status)
        .fontSize(13)
        .fontColor('#0a7')
        .width('100%')
        .margin({ top: 6 })

      Text('说明：只把短信内容发到你自己填的地址，不经过第三方；鸿蒙不允许普通应用直接读短信，所以默认用「复制 → 点一下」的方式。')
        .fontSize(12)
        .fontColor('#999')
        .width('100%')
        .margin({ top: 8 })
    }
    .padding(20)
    .width('100%')
    .height('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
