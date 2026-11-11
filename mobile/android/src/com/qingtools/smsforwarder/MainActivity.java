package com.qingtools.smsforwarder;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * Qing Tools 短信转发 —— 把手机收到的验证码短信 POST 给桌面灵动岛。
 * 为了直接用 javac + d8 构建（不走 Gradle），全部用匿名内部类，不写 lambda。
 */
public class MainActivity extends Activity {
    static final String PREFS = "qingtools_sms";
    static final String DEF_URL = "https://chat.ccyyqq.com/island/api/hook/sms";

    private EditText urlField;
    private EditText tokenField;
    private TextView status;
    private android.widget.CheckBox allBox;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        final SharedPreferences sp = getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        ScrollView scroll = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        final int pad = (int) (18 * getResources().getDisplayMetrics().density);
        box.setPadding(pad, pad, pad, pad);
        scroll.addView(box);

        TextView title = new TextView(this);
        title.setText("Qing Tools 短信转发");
        title.setTextSize(20);
        box.addView(title);

        TextView hint = new TextView(this);
        hint.setText("收到含「验证码 / 代码 / 口令」的短信时，自动把内容和验证码发到桌面灵动岛。\n地址和密钥在电脑上：设置 → 短信验证码 → 手机端配置。");
        hint.setTextSize(13);
        hint.setPadding(0, pad / 2, 0, pad);
        box.addView(hint);

        urlField = new EditText(this);
        urlField.setHint("接口地址");
        urlField.setText(sp.getString("url", DEF_URL));
        urlField.setTextSize(13);
        urlField.setSingleLine(false);
        urlField.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        box.addView(urlField, lp(pad));

        tokenField = new EditText(this);
        tokenField.setHint("密钥");
        tokenField.setText(sp.getString("token", ""));
        tokenField.setTextSize(13);
        tokenField.setSingleLine(true);
        box.addView(tokenField, lp(pad));

        Button paste = new Button(this);
        paste.setText("从剪贴板粘贴配置");
        paste.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String raw = readClipboard();
                if (raw == null || raw.trim().length() == 0) {
                    status.setText("剪贴板是空的：先在电脑上点「设置 → 短信验证码 → 手机端配置」，把那段文字发到手机并复制。");
                    return;
                }
                boolean okToken = parseInto(raw);
                saveConfig();
                status.setText(okToken ? "已从剪贴板填入地址和密钥，记得点「保存并开启」。" : "没在里面找到密钥，请手动粘贴。");
            }
        });
        box.addView(paste, lp(pad));

        allBox = new android.widget.CheckBox(this);
        allBox.setText("转发所有短信（不只看验证码）");
        allBox.setTextSize(13);
        allBox.setChecked(sp.getBoolean("all", false));
        allBox.setOnCheckedChangeListener(new android.widget.CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(android.widget.CompoundButton b, boolean checked) {
                getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("all", checked).apply();
            }
        });
        box.addView(allBox, lp(pad));

        Button backfill = new Button(this);
        backfill.setText("补发最近 15 分钟的短信");
        backfill.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                saveConfig();
                ensureSmsPermission();
                backfillInbox();
            }
        });
        box.addView(backfill, lp(pad));

        Button keep = new Button(this);
        keep.setText("开启后台常驻（推荐先点这个）");
        keep.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                saveConfig();
                startForwarding();
                requestIgnoreBattery();
                status.setText("已开启后台常驻：通知栏会常驻一条「Qing Tools 短信转发」，请不要划掉它。\n"
                        + "如果系统提示「允许后台运行 / 省电无限制 / 自启动」，全部选允许。");
            }
        });
        box.addView(keep, lp(pad));

        Button save = new Button(this);
        save.setText("保存并开启");
        save.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                saveConfig();
                ensureSmsPermission();
                startForwarding();
                status.setText("已保存并开启后台常驻。收到验证码短信（或点下面的测试）就会推送到桌面。");
            }
        });
        box.addView(save, lp(pad));

        Button test = new Button(this);
        test.setText("发送一条测试");
        test.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                saveConfig();
                final String url = urlField.getText().toString().trim();
                final String token = tokenField.getText().toString().trim();
                status.setText("正在发送测试…");
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        final String r = Sender.post(url, token, "测试", "Qing Tools 测试验证码 123456");
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                status.setText(r);
                            }
                        });
                    }
                }).start();
            }
        });
        box.addView(test, lp(pad));

        Button perm = new Button(this);
        perm.setText("打开应用权限设置");
        perm.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    Intent it = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    it.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(it);
                } catch (Throwable ignored) {
                }
            }
        });
        box.addView(perm, lp(pad));

        status = new TextView(this);
        status.setTextSize(13);
        status.setPadding(0, pad / 2, 0, 0);
        status.setText(hasSmsPermission() ? "短信权限已开启。" : "还没有短信权限：点「保存并开启」会弹授权。");
        box.addView(status);

        TextView note = new TextView(this);
        note.setTextSize(12);
        note.setPadding(0, pad, 0, 0);
        note.setText("说明：只在本机把短信转发到你自己的服务器，不保存到任何第三方；不上架应用商店，自己安装即可。");
        box.addView(note);

        setContentView(scroll);
        ensureSmsPermission();
        // 已经配好过就一直挂上后台服务：进程活着，短信广播才不会因为被冻结而丢
        if (getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("token", "").length() > 0) {
            startForwarding();
        }
    }

    /** 拉起前台常驻服务 */
    private void startForwarding() {
        try {
            Intent svc = new Intent(this, ForwardService.class);
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(svc);
            else startService(svc);
        } catch (Throwable ignored) {
        }
    }

    /** 请求「忽略电池优化」，否则小米/华为会在息屏后冻住进程 */
    private void requestIgnoreBattery() {
        try {
            if (Build.VERSION.SDK_INT >= 23) {
                android.os.PowerManager pm = (android.os.PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null && pm.isIgnoringBatteryOptimizations(getPackageName())) return;
                Intent it = new Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                it.setData(Uri.parse("package:" + getPackageName()));
                startActivity(it);
            }
        } catch (Throwable ignored) {
        }
    }

    private LinearLayout.LayoutParams lp(int pad) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = (int) (8 * getResources().getDisplayMetrics().density);
        return p;
    }

    private void saveConfig() {
        // 宽容一点：用户可能把「密钥 xxx」或整段配置、甚至带 token 的网址直接贴进来
        String url = urlField.getText().toString().trim();
        String token = tokenField.getText().toString().trim();
        if (token.length() == 0 || token.indexOf(' ') > 0 || token.indexOf('\n') > 0) {
            parseInto(token.length() > 0 ? token : "");
        }
        if (url.length() > 0 && url.indexOf("token=") > 0) parseInto(url);
        getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString("url", urlField.getText().toString().trim())
                .putString("token", tokenField.getText().toString().trim())
                .apply();
    }

    /** 从一段任意文本里抠出接口地址和密钥，成功返回 true */
    private boolean parseInto(String raw) {
        if (raw == null) return false;
        boolean gotToken = false;
        java.util.regex.Matcher mu = java.util.regex.Pattern
                .compile("https?://[^\\s\"'<>]*/(?:api/)?(?:hook/sms|sms)")
                .matcher(raw);
        if (mu.find()) {
            urlField.setText(mu.group());
        }
        java.util.regex.Matcher mt = java.util.regex.Pattern
                .compile("token=([A-Za-z0-9_\\-]{8,})").matcher(raw);
        if (mt.find()) {
            tokenField.setText(mt.group(1));
            gotToken = true;
        } else {
            java.util.regex.Matcher mk = java.util.regex.Pattern
                    .compile("(?:密钥|key|secret)\\s*[:：]?\\s*([A-Za-z0-9_\\-]{8,})",
                            java.util.regex.Pattern.CASE_INSENSITIVE).matcher(raw);
            if (mk.find()) {
                tokenField.setText(mk.group(1));
                gotToken = true;
            } else if (raw.trim().matches("[A-Za-z0-9_\\-]{12,}")) {
                tokenField.setText(raw.trim());
                gotToken = true;
            }
        }
        return gotToken;
    }

    private String readClipboard() {
        try {
            android.content.ClipboardManager cm = (android.content.ClipboardManager)
                    getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm == null || !cm.hasPrimaryClip() || cm.getPrimaryClip() == null) return null;
            android.content.ClipData.Item it = cm.getPrimaryClip().getItemAt(0);
            CharSequence cs = it.coerceToText(this);
            return cs == null ? null : cs.toString();
        } catch (Throwable t) {
            return null;
        }
    }

    private boolean hasSmsPermission() {
        if (Build.VERSION.SDK_INT < 23) return true;
        return checkSelfPermission("android.permission.RECEIVE_SMS") == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasReadSms() {
        if (Build.VERSION.SDK_INT < 23) return true;
        return checkSelfPermission("android.permission.READ_SMS") == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * 兜底：直接读短信收件箱，把最近 15 分钟里还没转发过的短信补发一遍。
     * 小米等系统在后台可能拦掉 SMS_RECEIVED 广播，这时靠它把漏掉的补上。
     */
    private void backfillInbox() {
        if (!hasReadSms()) {
            if (Build.VERSION.SDK_INT >= 23) requestPermissions(new String[]{"android.permission.RECEIVE_SMS", "android.permission.READ_SMS"}, 1002);
            status.setText("需要「读取短信」权限才能补发：授权后再点一次。");
            return;
        }
        final SharedPreferences sp = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        final String url = sp.getString("url", DEF_URL);
        final String token = sp.getString("token", "");
        if (token.length() == 0) {
            status.setText("还没填密钥。");
            return;
        }
        final long since = System.currentTimeMillis() - 15 * 60 * 1000L;
        final boolean all = sp.getBoolean("all", false);
        final long lastId = sp.getLong("lastSmsId", 0);
        status.setText("正在补发…");
        new Thread(new Runnable() {
            @Override
            public void run() {
                int sent = 0;
                int seen = 0;
                long maxId = lastId;
                try {
                    android.database.Cursor c = getContentResolver().query(
                            Uri.parse("content://sms/inbox"),
                            new String[]{"_id", "address", "body", "date"},
                            "date>=?", new String[]{String.valueOf(since)}, "date ASC");
                    if (c != null) {
                        while (c.moveToNext() && sent < 10) {
                            long id = c.getLong(0);
                            String addr = c.getString(1);
                            String body = c.getString(2);
                            seen++;
                            if (id <= lastId) continue;
                            if (id > maxId) maxId = id;
                            if (body == null) continue;
                            if (!all && !java.util.regex.Pattern.compile(
                                    "验证码|校验码|动态码|确认码|激活码|口令|一次性代码|一次性密码|verification|code|passcode|otp",
                                    java.util.regex.Pattern.CASE_INSENSITIVE).matcher(body).find()) continue;
                            String r = Sender.post(MainActivity.this, url, token, addr == null ? "" : addr, body);
                            if (r != null && r.startsWith("已发送")) sent++;
                        }
                        c.close();
                    }
                } catch (Throwable t) {
                    status.setText("读收件箱失败：" + t.getMessage());
                    return;
                }
                sp.edit().putLong("lastSmsId", maxId).apply();
                final int fSent = sent;
                final int fSeen = seen;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        status.setText(fSent == 0
                                ? ("最近 15 分钟没有需要补发的短信（扫到 " + fSeen + " 条）。")
                                : ("已补发 " + fSent + " 条短信到桌面。"));
                    }
                });
            }
        }).start();
    }

    private void ensureSmsPermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            java.util.ArrayList<String> need = new java.util.ArrayList<String>();
            if (checkSelfPermission("android.permission.RECEIVE_SMS") != PackageManager.PERMISSION_GRANTED) {
                need.add("android.permission.RECEIVE_SMS");
            }
            if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                need.add("android.permission.POST_NOTIFICATIONS");
            }
            if (!need.isEmpty()) requestPermissions(need.toArray(new String[0]), 1001);
            return;
        }
        if (Build.VERSION.SDK_INT >= 23 && !hasSmsPermission()) {
            requestPermissions(new String[]{"android.permission.RECEIVE_SMS"}, 1001);
        }
    }
}
