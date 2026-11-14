import fs from "node:fs";
const p = "src/renderer/styles.css";
let s = fs.readFileSync(p, "utf8");
const anchor = `.check-btn {
  flex: none;
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
  border-radius: 50%;
  background: transparent;
  color: color-mix(in srgb, var(--ink) 45%, transparent);
  cursor: pointer;
  transition: background 140ms var(--smooth), border-color 140ms var(--smooth), color 140ms var(--smooth);
}
.check-btn .ic { width: 12px; height: 12px; }
.check-btn:hover { border-color: var(--accent); color: var(--accent); }
.check-btn.on { background: var(--accent); border-color: var(--accent); color: #fff; }`;
const next = `.check-btn {
  flex: none;
  align-self: flex-start;
  display: inline-grid;
  place-items: center;
  width: 17px;
  height: 17px;
  margin: 2px 0 0;
  padding: 0;
  border: 1.2px solid color-mix(in srgb, var(--ink) 26%, transparent);
  border-radius: 50%;
  background: transparent;
  color: transparent;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  transition: border-color 140ms var(--smooth), color 140ms var(--smooth), background 140ms var(--smooth);
}
.check-btn .ic { width: 11px; height: 11px; stroke-width: 2.4; }
.check-btn:hover { border-color: var(--accent); color: color-mix(in srgb, var(--accent) 70%, transparent); }
.check-btn.on {
  border-color: var(--accent);
  background: transparent;
  color: var(--accent);
}`;
if (!s.includes(anchor)) { console.error("anchor missing"); process.exit(2); }
s = s.replace(anchor, next);
fs.writeFileSync(p, s);
const pal = "src/renderer/palette.css";
let q = fs.readFileSync(pal, "utf8");
q = q.replace(/\.check-btn \{[\s\S]*?\}\n\n\.check-btn \.ic \{[\s\S]*?\}\n\n\.check-btn:hover \{[\s\S]*?\}\n\n/, "");
q = q.replace(/\.row\.todo\.done \.check-btn \{[\s\S]*?\}\n\n/, "");
fs.writeFileSync(pal, q);
console.log("ok", s.length, q.includes(".check-btn"));