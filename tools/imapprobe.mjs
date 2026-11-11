import tls from "node:tls";
function probe(host, user, label) {
  return new Promise((resolve) => {
    const sock = tls.connect({ host, port: 993, servername: host, timeout: 12000 }, () => {});
    let buf = "";
    const out = [];
    let loginSent = false;
    const done = (why) => { try { sock.destroy(); } catch (_) {} resolve(why + " :: " + out.join(" | ")); };
    sock.on("data", (d) => {
      buf += d.toString("utf8");
      let i;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (line.trim()) out.push(line.slice(0, 200));
        if (!loginSent && /^\* OK/i.test(line)) {
          loginSent = true;
          setTimeout(() => sock.write("a1 LOGIN " + user + " wrong-password-xyz\r\n"), 80);
        }
        if (/^a1 (OK|NO|BAD)/i.test(line)) { done(label); return; }
      }
    });
    sock.on("timeout", () => done("timeout"));
    sock.on("error", (e) => done("err:" + e.message));
    setTimeout(() => done("slow"), 20000);
  });
}
console.log(await probe("outlook.office365.com", "probe@hotmail.com", "office365"));
console.log(await probe("imap-mail.outlook.com", "probe@hotmail.com", "outlook-legacy"));
