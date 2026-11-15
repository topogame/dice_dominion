// Copies the KayKit models (CC0, by Kay Lousberg) into public/models and
// slims the knight down to the animations the game plays.
//
//   node scripts/prepare-models.mjs <folder with the downloaded files>
//
// The folder is expected to contain `hexagon/` (glTF files of the Medieval
// Hexagon Pack) and `characters/Knight.glb` (Adventurers Character Pack).
import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { dedup, prune, resample } from '@gltf-transform/functions';

const src = process.argv[2];
if (!src) throw new Error('usage: node scripts/prepare-models.mjs <download folder>');
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/models');
await mkdir(out, { recursive: true });

// ── Buildings and scenery: plain copies ────────────────────────────────
let copied = 0;
for (const name of await readdir(path.join(src, 'hexagon'))) {
  if (!/\.(gltf|bin|png)$/.test(name)) continue;
  await copyFile(path.join(src, 'hexagon', name), path.join(out, name));
  copied++;
}

// ── Knight: keep one loadout and the animations in use ─────────────────
const KEEP_ANIMATIONS = new Set([
  'Idle',
  '1H_Melee_Attack_Chop',
  '1H_Melee_Attack_Slice_Diagonal',
  '1H_Melee_Attack_Stab',
  'Block',
  'Block_Hit',
  'Hit_A',
  'Death_A',
  'Cheer',
]);
// The model ships with every weapon and shield attached; the game shows a
// one-handed sword and the round shield.
const DROP_NODES = new Set(['1H_Sword_Offhand', '2H_Sword', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield']);

const io = new NodeIO();
const doc = await io.read(path.join(src, 'characters', 'Knight.glb'));
const root = doc.getRoot();
const before = (await stat(path.join(src, 'characters', 'Knight.glb'))).size;

for (const animation of root.listAnimations()) {
  if (KEEP_ANIMATIONS.has(animation.getName())) continue;
  // Channels and samplers must go too, or their keyframe data stays in the file.
  animation.listChannels().forEach((channel) => channel.dispose());
  animation.listSamplers().forEach((sampler) => sampler.dispose());
  animation.dispose();
}
for (const node of root.listNodes()) {
  if (DROP_NODES.has(node.getName())) node.dispose();
}
// resample() drops keyframes that plain interpolation reproduces anyway.
await doc.transform(resample(), prune(), dedup());

const knightOut = path.join(out, 'knight.glb');
await io.write(knightOut, doc);
const after = (await stat(knightOut)).size;

await writeFile(
  path.join(out, 'CREDITS.txt'),
  [
    '3D models in this folder are from the KayKit asset packs by Kay Lousberg',
    '(www.kaylousberg.com), released under Creative Commons Zero (CC0):',
    '',
    '- KayKit : Medieval Hexagon Pack 1.0   (castles, trees, rocks, mountains, props)',
    '- KayKit : Adventurers Character Pack 1.0   (knight.glb, trimmed by scripts/prepare-models.mjs)',
    '',
    'Source: https://github.com/KayKit-Game-Assets',
    '',
  ].join('\n'),
);

console.log(`copied ${copied} scenery files`);
console.log(`knight: ${(before / 1048576).toFixed(2)} MB -> ${(after / 1048576).toFixed(2)} MB, animations kept: ${root.listAnimations().map((a) => a.getName()).join(', ')}`);
console.log(`knight nodes with meshes: ${root.listNodes().filter((n) => n.getMesh()).map((n) => n.getName()).join(', ')}`);
