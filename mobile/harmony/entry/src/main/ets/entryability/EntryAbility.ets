import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';
import { Cfg, loadCfg } from '../common/Config';
import * as watcher from '../notif/SmsWatcher';

const TAG: string = 'QingToolsSms';

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    hilog.info(0x0000, TAG, 'onCreate');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(0x0000, TAG, 'loadContent failed: %{public}s', JSON.stringify(err));
      }
    });
    // 上次开过「自动监听」就顺手恢复（没有 ACL 时会失败，不影响页面使用）
    loadCfg(this.context).then((cfg: Cfg) => {
      if (cfg.token.length > 0) {
        watcher.start(cfg, (s: string) => {
          hilog.info(0x0000, TAG, '%{public}s', s);
        });
      }
    });
  }

  onDestroy(): void {
    watcher.stop();
  }
}
