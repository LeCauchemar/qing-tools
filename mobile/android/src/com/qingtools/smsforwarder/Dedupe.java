package com.qingtools.smsforwarder;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * 去重：同一条短信可能被两条路径各发一次 —— SMS_RECEIVED 广播（实时）和 ForwardService 的收件箱轮询（兜底）。
 *
 * 广播拿到的是 PDU，没有数据库 _id，所以轮询那边没法用 _id 判断「这条是不是已经发过了」，
 * 只能按正文做短期去重：发成功的正文记一个哈希 + 时间戳，10 分钟内同样的正文不再发。
 *
 * 为什么是 10 分钟：验证码短信几乎不可能在 10 分钟内来两条一字不差的；
 * 而轮询窗口本身也就最近几条，10 分钟足够盖住「广播发完 → 轮询又想发一遍」这个重叠区。
 */
final class Dedupe {
    private static final String KEY = "sentKeys";
    private static final long WINDOW_MS = 10 * 60 * 1000L;
    private static final int KEEP = 16;

    private Dedupe() {}

    static boolean seen(Context ctx, String text) {
        if (text == null || text.isEmpty()) return false;
        String h = hash(text);
        long now = System.currentTimeMillis();
        String[] parts = sp(ctx).getString(KEY, "").split(",");
        for (String p : parts) {
            int i = p.lastIndexOf(':');
            if (i <= 0) continue;
            if (!h.equals(p.substring(0, i))) continue;
            long ts;
            try {
                ts = Long.parseLong(p.substring(i + 1));
            } catch (NumberFormatException e) {
                continue;
            }
            if (now - ts <= WINDOW_MS) return true;
        }
        return false;
    }

    static void mark(Context ctx, String text) {
        if (text == null || text.isEmpty()) return;
        String h = hash(text);
        long now = System.currentTimeMillis();
        StringBuilder b = new StringBuilder();
        int kept = 0;
        for (String p : sp(ctx).getString(KEY, "").split(",")) {
            int i = p.lastIndexOf(':');
            if (i <= 0) continue;
            long ts;
            try {
                ts = Long.parseLong(p.substring(i + 1));
            } catch (NumberFormatException e) {
                continue;
            }
            if (now - ts > WINDOW_MS) continue;
            if (p.substring(0, i).equals(h)) continue;
            if (kept >= KEEP) break;
            if (b.length() > 0) b.append(',');
            b.append(p);
            kept++;
        }
        if (b.length() > 0) b.append(',');
        b.append(h).append(':').append(now);
        sp(ctx).edit().putString(KEY, b.toString()).apply();
    }

    /** 32 位 FNV-1a，够用且不引入依赖 */
    private static String hash(String s) {
        int h = 0x811c9dc5;
        for (int i = 0; i < s.length(); i++) {
            h ^= s.charAt(i);
            h *= 0x01000193;
        }
        return String.format("%08x", h);
    }

    private static SharedPreferences sp(Context ctx) {
        return ctx.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE);
    }
}
