// Shrinks a generated or bought model for the game and puts it in
// public/models/custom: fewer triangles, smaller textures.
//
//   node scripts/prepare-custom-model.mjs <input.glb> <name> [triangles=45000] [texture=1024] [error=0.01]
//
// `error` is how far the simplifier may move the surface, as a fraction of the
// model's size. Leafy models need about 0.06 to get down to a few thousand triangles.
//
// `sharp`, `meshoptimizer`, `draco3d` and `@gltf-transform/extensions` arrive
// with @gltf-transform/functions; they are not listed in package.json.
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dedup, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3d';
import sharp from 'sharp';

const [input, name, trianglesArg = '45000', textureArg = '1024', errorArg = '0.01'] = process.argv.slice(2);
if (!input || !name) throw new Error('usage: node scripts/prepare-custom-model.mjs <input.glb> <name> [triangles] [texture]');
const targetTriangles = Number(trianglesArg);
const textureSize = Number(textureArg);

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/models/custom');
await mkdir(outDir, { recursive: true });
const output = path.join(outDir, `${name}.glb`);

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
  'draco3d.decoder': await draco3d.createDecoderModule(),
});

const doc = await io.read(input);
const root = doc.getRoot();

const countTriangles = () =>
  root
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .reduce((sum, prim) => sum + (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3, 0);
const describeTextures = () =>
  root
    .listTextures()
    .map((t) => `${t.getName() || t.getURI() || 'texture'} ${t.getSize()?.join('x')} ${t.getMimeType()}`)
    .join(', ');

const before = { triangles: countTriangles(), bytes: (await stat(input)).size, textures: describeTextures() };

// Draco and meshopt packing are dropped on the way out: the game loads plain glTF.
for (const extension of root.listExtensionsUsed()) {
  if (/draco|meshopt/i.test(extension.extensionName)) extension.dispose();
}

await doc.transform(dedup(), weld());
const ratio = Math.min(1, targetTriangles / countTriangles());
if (ratio < 1) {
  // A loose error bound lets the simplifier reach the target on dense generated meshes.
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: Number(errorArg), lockBorder: false }));
}
// Foliage comes out of the generator as thousands of tiny separate shells,
// which ordinary simplifying cannot merge. If the target is still far off,
// drop the smallest shells and simplify again with a looser bound. Simplifying
// without regard to how the surface is connected would get further, but it
// turns a tree into a dark tangle, so it is not used.
if (countTriangles() > targetTriangles * 1.3) {
  for (const prim of root.listMeshes().flatMap((mesh) => mesh.listPrimitives())) {
    const positions = new Float32Array(prim.getAttribute('POSITION').getArray());
    const indices = new Uint32Array(prim.getIndices().getArray());
    prim.getIndices().setArray(MeshoptSimplifier.simplifyPrune(indices, positions, 3, Number(errorArg)));
    compactPrimitive(prim);
  }
  const again = Math.min(1, targetTriangles / countTriangles());
  if (again < 1) {
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: again, error: Number(errorArg) * 2, lockBorder: false }));
  }
}

await doc.transform(
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [textureSize, textureSize], quality: 88 }),
);

await io.write(output, doc);
const after = { triangles: countTriangles(), bytes: (await stat(output)).size, textures: describeTextures() };

const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;
console.log(`in : ${mb(before.bytes)}, ${Math.round(before.triangles)} triangles, textures: ${before.textures}`);
console.log(`out: ${mb(after.bytes)}, ${Math.round(after.triangles)} triangles, textures: ${after.textures}`);
console.log(`meshes: ${root.listMeshes().length}, materials: ${root.listMaterials().length}`);
console.log(output);
