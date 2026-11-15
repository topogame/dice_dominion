// Cuts the HUD artwork (shield emblems, portraits, the dice medallion) out of
// the concept picture and writes it to src/ui/art.
//   node scripts/cut-hud-art.mjs . reference/hedef-gorsel.webp src/ui/art [sheet.png]
// With a sheet path it also writes a contact sheet of everything, for checking the crops.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const [projectDir, source, outDir, sheet] = process.argv.slice(2);
const sharp = createRequire(path.join(projectDir, 'package.json'))('sharp');
fs.mkdirSync(outDir, { recursive: true });

const SCALE = 3;
// Centres in the concept picture's own pixels (1672x941).
const SHIELD = { w: 74, h: 88 };
const AVATAR = 37;
const items = [
  { name: 'shield-blue', cx: 107, cy: 822.5, w: 88, h: 104 },
  { name: 'shield-yellow', cx: 444, cy: 819.5, ...SHIELD },
  { name: 'shield-green', cx: 1039, cy: 819.5, ...SHIELD },
  { name: 'shield-red', cx: 1384.5, cy: 818.5, ...SHIELD },
  { name: 'avatar-blue', cx: 187, cy: 837, r: AVATAR },
  { name: 'avatar-yellow', cx: 513, cy: 835, r: AVATAR },
  { name: 'avatar-green', cx: 1113, cy: 835, r: AVATAR },
  { name: 'avatar-red', cx: 1459, cy: 835, r: AVATAR },
  { name: 'medallion', cx: 839, cy: 830, r: 99 },
];

const made = [];
for (const it of items) {
  const w = it.r ? it.r * 2 : it.w;
  const h = it.r ? it.r * 2 : it.h;
  const left = Math.round(it.cx - w / 2);
  const top = Math.round(it.cy - h / 2);
  let image = sharp(source)
    .extract({ left, top, width: Math.round(w), height: Math.round(h) })
    .resize({ width: Math.round(w * SCALE), height: Math.round(h * SCALE), kernel: 'lanczos3' });
  if (it.r) {
    // Round pieces get a soft-edged circular mask.
    const size = Math.round(w * SCALE);
    const mask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="#fff"/></svg>`,
    );
    image = sharp(await image.png().toBuffer()).composite([{ input: mask, blend: 'dest-in' }]);
  }
  const file = path.join(outDir, `${it.name}.webp`);
  await image.webp({ quality: 90, alphaQuality: 95 }).toFile(file);
  const meta = await sharp(file).metadata();
  made.push({ file, width: meta.width, height: meta.height });
  console.log(it.name, `${meta.width}x${meta.height}`, `${fs.statSync(file).size} bytes`);
}

if (sheet) {
  let x = 10;
  const parts = [];
  for (const m of made) {
    parts.push({ input: m.file, left: x, top: 10 });
    x += m.width + 10;
  }
  const height = Math.max(...made.map((m) => m.height)) + 20;
  await sharp({ create: { width: x, height, channels: 3, background: '#30384f' } }).composite(parts).png().toFile(sheet);
  console.log(sheet);
}
