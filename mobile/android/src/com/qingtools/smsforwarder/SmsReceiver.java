package com.qingtools.smsforwarder;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.telephony.SmsMessage;

import java.util.regex.Pattern;

/**
 * 收到短信 → 命中验证码关键词就转发到桌面。
 *
 * 关键点：必须用 goAsync() + PendingResult.finish()。
 * 早期版本在 onReceive 里起一个裸 Thread 就 return，前台时进程还活着，能发出去；
 * 一旦退到后台，系统认为这次广播已经处理完，会立刻冻结/回收进程，
 * 那个线程还没把 HTTP 请求发完就被掐掉了 —— 表现就是「必须开着应用才能转发」。
 */
public class SmsReceiver extends BroadcastReceiver {
    static final Pattern HINT = Pattern.compile(
            "验证码|校验码|动态码|确认码|激活码|口令|一次性代码|一次性密码|verification|code|passcode|otp",
            Pattern.CASE_INSENSITIVE);

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (intent == null || !"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) return;
        final SharedPreferences sp = ctx.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE);
        final String url = sp.getString("url", MainActivity.DEF_URL);
        final String token = sp.getString("token", "");
        if (token.isEmpty()) return;

        Bundle bundle = intent.getExtras();
        if (bundle == null) return;
        Object[] pdus = (Object[]) bundle.get("pdus");
        String format = bundle.getString("format");
        if (pdus == null) return;

        StringBuilder body = new StringBuilder();
        String from = "";
        for (Object pdu : pdus) {
            SmsMessage msg;
            try {
                msg = SmsMessage.createFromPdu((byte[]) pdu, format);
            } catch (Throwable t) {
                continue;
            }
            if (msg == null) continue;
            if (from.isEmpty() && msg.getOriginatingAddress() != null) from = msg.getOriginatingAddress();
            if (msg.getMessageBody() != null) body.append(msg.getMessageBody());
        }
        final String text = body.toString().trim();
        if (text.isEmpty()) return;
        // 默认只转发验证码类短信；用户在应用里勾了「转发所有短信」就全转发
        if (!sp.getBoolean("all", false) && !HINT.matcher(text).find()) return;

        // 让系统在这段异步工作结束前不要回收我们
        final PendingResult pending = goAsync();
        final String fUrl = url;
        final String fToken = token;
        final String fFrom = from;
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Sender.post(ctx, fUrl, fToken, fFrom, text);
                } finally {
                    pending.finish();
                }
            }
        }).start();
    }
}
