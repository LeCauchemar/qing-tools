const urls = [
  "https://qingtools.ccyyqq.com/changelog.html",
  "https://qingtools.ccyyqq.com/"
];
for (const u of urls) {
  const r = await fetch(u);
  const t = await r.text();
  console.log(u, r.status, t.length,
    "v1151", t.includes("1.15.1"),
    "b63", t.includes("<b>63</b>"),
    "entry", t.includes("Base64 能读图片"),
    "dl", t.includes("QingTools-1.15.1-setup.exe"));
}
for (const u of [
  "https://qing.ccyyqq.com/island/update/QingTools-1.15.1-setup.exe",
  "https://qing.ccyyqq.com/island/update/QingTools-1.15.1-portable.exe",
  "https://chat.ccyyqq.com/island/update/QingTools-1.15.1-setup.exe"
]) {
  const r = await fetch(u, { headers: { Range: "bytes=0-15" } });
  const b = await r.arrayBuffer();
  console.log(u.split("/").pop(), r.status, b.byteLength, (r.headers.get("content-range") || ""));
}