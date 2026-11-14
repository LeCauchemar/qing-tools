/**
 * 彻底清掉一个频道名下的所有东西：消息、表情包、投票、图片（又拍云对象 + 本地文件）、成员、房间本身。
 * 只按 room_id 过滤，绝不碰别的频道的数据。
 */
import fs from 'node:fs';
import path from 'node:path';
import { deleteObject } from './upyun.mjs';

export async function purgeRoom(db, { mediaDir, roomId, log = () => {} }) {
  if (!roomId) return { roomId, skipped: true };
  const mediaRows = db.prepare('SELECT id, file FROM media WHERE room_id = ?').all(roomId);
  let cloud = 0;
  let local = 0;
  let missing = 0;

  for (const m of mediaRows) {
    const file = String(m.file || '');
    if (file.startsWith('cloud:')) {
      const key = file.slice(6);
      try {
        const r = await deleteObject(key);
        if (r && r.ok) cloud += 1;
        else missing += 1;
      } catch {
        missing += 1;
      }
      continue;
    }
    const name = path.basename(file.replace(/^local:/, ''));
    if (!name) continue;
    try {
      fs.unlinkSync(path.join(mediaDir, name));
      local += 1;
    } catch {
      missing += 1;
    }
  }

  const before = {
    messages: db.prepare('SELECT COUNT(*) n FROM messages WHERE room_id = ?').get(roomId).n,
    stickers: db.prepare('SELECT COUNT(*) n FROM stickers WHERE room_id = ?').get(roomId).n,
    devices: db.prepare('SELECT COUNT(*) n FROM devices WHERE room_id = ?').get(roomId).n
  };

  db.prepare('DELETE FROM vote_ballots WHERE vote_id IN (SELECT id FROM votes WHERE room_id = ?)').run(roomId);
  db.prepare('DELETE FROM votes WHERE room_id = ?').run(roomId);
  db.prepare('DELETE FROM messages WHERE room_id = ?').run(roomId);
  db.prepare('DELETE FROM stickers WHERE room_id = ?').run(roomId);
  db.prepare('DELETE FROM media WHERE room_id = ?').run(roomId);
  db.prepare('DELETE FROM devices WHERE room_id = ?').run(roomId);
  db.prepare('DELETE FROM room_members WHERE room_id = ?').run(roomId);
  db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);

  const out = { roomId, ...before, media: mediaRows.length, cloud, local, missing };
  log('room purged', JSON.stringify(out));
  return out;
}
