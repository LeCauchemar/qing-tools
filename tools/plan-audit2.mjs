import fs from "node:fs";
const app = fs.readFileSync("src/renderer/app.js", "utf8");
const main = fs.readFileSync("src/main/main.js", "utf8");
const srv = fs.readFileSync("server/index.mjs", "utf8");
console.log("待办浮窗(todo float window)?", /todoWin|todosFloat|floatWindow/.test(main + app));
console.log("分享图片 images?", /share\(/.test(app) && /sourceItem/.test(app));
console.log("sms 表列:", (srv.match(/CREATE TABLE IF NOT EXISTS sms \(([\s\S]*?)\)/) || [])[1].replace(/\s+/g, " ").slice(0, 200));
console.log("未读角标卫星 wiki?", /unread/i.test(app));