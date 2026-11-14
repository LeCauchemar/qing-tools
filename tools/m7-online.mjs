const urls = {
  changelog: "https://qingtools.ccyyqq.com/changelog.html",
  home: "https://qingtools.ccyyqq.com/",
  manifest: "https://qingtools.ccyyqq.com/latest.json"
};
for (const [k, u] of Object.entries(urls)) {
  const r = await fetch(u, { cache: "no-store" });
  const t = await r.text();
  console.log(k, r.status, t.length,
    k === "manifest" ? t.slice(0, 120) : ["1.15.0", "<b>62</b>", "v1.15.0", "细圈"].map((s) => s + "=" + t.includes(s)).join(" "));
}