package com.qingtools.smsforwarder;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;

/**
 * 常驻前台服务：让进程一直活着，短信广播就一定能收到；再每 60 秒扫一遍收件箱兜底。
 *
 * 为什么需要它：
 *  1) 广播接收器只在 onReceive 期间有「进程保护」，后台被冻结时通知栏没东西，MIUI 会很快把进程冻住；
 *  2) 小米/红米等系统对没开「自启动」的后台应用可能直接不投递 SMS_RECEIVED，
 *     这时靠轮询收件箱把漏掉的短信补上去。
 */
public class ForwardService extends Service {
    static final int NOTI_ID = 7701;
    static final String CHANNEL = "qingtools_sms";

    private Handler handler;
    private Runnable tick;
    private SharedPreferences sp;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        sp = getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE);
        startForegroundSafe();
        handler = new Handler();
        tick = new Runnable() {
            @Override
            public void run() {
                // 网络请求不能放在主线程（会 ANR），丢给工作线程
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            pollInbox();
                        } catch (Throwable ignored) {
                        }
                    }
                }).start();
                if (handler != null) handler.postDelayed(this, 60000);
            }
        };
        // 启动后 4 秒先扫一次（把服务没跑起来那段时间的短信补上）
        handler.postDelayed(tick, 4000);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForegroundSafe();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (handler != null && tick != null) handler.removeCallbacks(tick);
        super.onDestroy();
    }

    private void startForegroundSafe() {
        try {
            startForeground(NOTI_ID, buildNoti("后台转发中 · 收到验证码会自动发送"));
        } catch (Throwable ignored) {
        }
    }

    private Notification buildNoti(String text) {
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL) == null) {
                NotificationChannel c = new NotificationChannel(CHANNEL, "短信转发", NotificationManager.IMPORTANCE_LOW);
                c.setShowBadge(false);
                c.enableVibration(false);
                nm.createNotificationChannel(c);
            }
            b = new Notification.Builder(this, CHANNEL);
        } else {
            b = new Notification.Builder(this);
        }
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open,
                Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                        : PendingIntent.FLAG_UPDATE_CURRENT);
        b.setSmallIcon(android.R.drawable.ic_dialog_email)
                .setContentTitle("Qing Tools 短信转发")
                .setContentText(text)
                .setOngoing(true)
                .setPriority(Notification.PRIORITY_LOW)
                .setContentIntent(pi);
        return b.build();
    }

    /** 兜底轮询：读「读取短信」权限，按 _id 增量取新短信 */
    private void pollInbox() {
        if (Build.VERSION.SDK_INT >= 23
                && checkSelfPermission("android.permission.READ_SMS") != PackageManager.PERMISSION_GRANTED) return;
        final String url = sp.getString("url", MainActivity.DEF_URL);
        final String token = sp.getString("token", "");
        if (token.isEmpty()) return;
        final boolean all = sp.getBoolean("all", false);
        final long lastId = sp.getLong("lastSmsId", 0);
        long maxId = lastId;
        int sent = 0;
        Cursor c = null;
        try {
            c = getContentResolver().query(Uri.parse("content://sms/inbox"),
                    new String[]{"_id", "address", "body", "date"},
                    null, null, "_id ASC");
            if (c != null) {
                while (c.moveToNext() && sent < 8) {
                    long id = c.getLong(0);
                    if (id <= lastId) continue;
                    String addr = c.getString(1);
                    String body = c.getString(2);
                    if (id > maxId) maxId = id;
                    if (body == null || body.trim().isEmpty()) continue;
                    if (!all && !SmsReceiver.HINT.matcher(body).find()) continue;
                    // 广播已经发过的那条会在这里被判为「重复短信」，不算进补发条数
                    String r = Sender.post(ForwardService.this, url, token, addr == null ? "" : addr, body.trim());
                    if (r != null && r.startsWith("已发送")) sent++;
                }
            }
        } catch (Throwable ignored) {
        } finally {
            if (c != null) c.close();
        }
        if (maxId > lastId) sp.edit().putLong("lastSmsId", maxId).apply();
        if (sent > 0) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                try {
                    nm.notify(NOTI_ID, buildNoti("刚补发 " + sent + " 条短信到桌面"));
                } catch (Throwable ignored) {
                }
            }
        }
    }
}
