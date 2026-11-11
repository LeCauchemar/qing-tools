package com.qingtools.smsforwarder;

import android.content.Context;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** 极简 HTTP POST（不引第三方库，包体小、启动快） */
final class Sender {
    private Sender() {}

    /**
     * 转发用：带 10 分钟正文去重。
     * 广播和轮询两条路径都会走这里，避免同一条短信被发两次（桌面弹两次条）。
     */
    static String post(Context ctx, String url, String token, String from, String text) {
        if (ctx != null && Dedupe.seen(ctx, text)) return "重复短信，已跳过";
        String r = post(url, token, from, text);
        if (ctx != null && r.startsWith("已发送")) Dedupe.mark(ctx, text);
        return r;
    }

    static String post(String url, String token, String from, String text) {
        HttpURLConnection c = null;
        try {
            if (url == null || url.isEmpty()) return "地址还没填";
            if (token == null || token.isEmpty()) return "密钥还没填";
            String full = url + (url.contains("?") ? "&" : "?") + "token=" + UriEncode(token);
            String body = "{\"from\":" + json(from) + ",\"text\":" + json(text) + ",\"src\":\"android\"}";
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);

            c = (HttpURLConnection) new URL(full).openConnection();
            c.setRequestMethod("POST");
            c.setConnectTimeout(8000);
            c.setReadTimeout(8000);
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            c.setRequestProperty("Content-Length", String.valueOf(bytes.length));
            try (OutputStream os = c.getOutputStream()) {
                os.write(bytes);
            }
            int code = c.getResponseCode();
            return code == 200 ? "已发送（HTTP 200）" : "服务器返回 HTTP " + code;
        } catch (Exception e) {
            return "发送失败：" + (e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static String UriEncode(String s) {
        try {
            return java.net.URLEncoder.encode(s, "UTF-8");
        } catch (Exception e) {
            return s;
        }
    }

    private static String json(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            switch (ch) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                default:
                    if (ch < 0x20) b.append(String.format("\\u%04x", (int) ch));
                    else b.append(ch);
            }
        }
        return b.append('"').toString();
    }
}
