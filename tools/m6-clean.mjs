import fs from 'node:fs';

const ids = ['usr_74e18aac7e24', 'usr_5ae099dae10a'];
const inList = ids.map((s) => `'${s}'`).join(',');
const sql = [
  `DELETE FROM shares WHERE from_user IN (${inList}) OR to_user IN (${inList});`,
  `DELETE FROM bindings WHERE from_user IN (${inList}) OR to_user IN (${inList});`,
  `DELETE FROM items WHERE owner_id IN (${inList});`,
  `DELETE FROM changes WHERE owner_id IN (${inList});`,
  `DELETE FROM sessions WHERE user_id IN (${inList});`,
  `DELETE FROM users WHERE id IN (${inList});`,
  "SELECT 'users|'||count(*) FROM users;",
  "SELECT 'rooms|'||count(*) FROM rooms;",
  "SELECT 'bindings|'||count(*) FROM bindings;",
  "SELECT 'shares|'||count(*) FROM shares;"
].join('\n');

fs.writeFileSync('D:/temp/clean-m6.sql', sql);
console.log('sql bytes', sql.length);
