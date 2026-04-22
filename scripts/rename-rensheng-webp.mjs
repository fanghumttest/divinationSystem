/**
 * 將 rensheng-webp 內「NN.任意文字.webp」改為「NN.webp」（兩位數）。
 * 若已存在短檔名而另有長檔名同號，刪除長檔名。
 */
import fs from "fs";
import path from "path";

const dir = path.resolve(
  process.argv[2] ?? path.join("..", "rensheng-webp")
);

function pad2(n) {
  return String(n).padStart(2, "0");
}

if (!fs.existsSync(dir)) {
  console.error("目錄不存在:", dir);
  process.exit(1);
}

const files = fs.readdirSync(dir).filter((f) => /\.webp$/i.test(f));

/** @type {{ full: string; target: string }[]} */
const plan = [];

for (const name of files) {
  const full = path.join(dir, name);

  if (/^(\d+)\.webp$/i.test(name)) {
    const m = name.match(/^(\d+)\.webp$/i);
    const n = parseInt(m[1], 10);
    const target = `${pad2(n)}.webp`;
    if (name !== target) plan.push({ full, target });
    continue;
  }

  const m = name.match(/^(\d+)\..+\.webp$/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 99) plan.push({ full, target: `${pad2(n)}.webp` });
  }
}

const byTarget = new Map();
for (const p of plan) {
  if (!byTarget.has(p.target)) byTarget.set(p.target, []);
  byTarget.get(p.target).push(p);
}

/** @type {{ full: string; target: string }[]} */
const finalRenames = [];

for (const [target, items] of byTarget) {
  const short = items.find(
    (i) => path.basename(i.full).toLowerCase() === target.toLowerCase()
  );
  const longs = items.filter(
    (i) => path.basename(i.full).toLowerCase() !== target.toLowerCase()
  );
  if (short && longs.length) {
    for (const l of longs) {
      fs.unlinkSync(l.full);
      console.log("已刪除重複長檔名:", path.basename(l.full));
    }
    if (path.basename(short.full) !== target) finalRenames.push(short);
    continue;
  }
  if (items.length > 1) {
    console.error(
      "同號多個來源，請手動處理:",
      target,
      items.map((i) => path.basename(i.full))
    );
    process.exit(1);
  }
  finalRenames.push(items[0]);
}

const tag = `.__ren_${Date.now()}.part`;
for (const p of finalRenames) {
  fs.renameSync(p.full, p.full + tag);
  p.tmp = p.full + tag;
}
for (const p of finalRenames) {
  const dest = path.join(dir, p.target);
  fs.renameSync(p.tmp, dest);
  console.log("→", p.target);
}

console.log("完成，共處理", finalRenames.length, "個重新命名");
