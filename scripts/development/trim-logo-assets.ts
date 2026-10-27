import path from 'path';
import fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Jimp = require(path.join(__dirname, '../../apps/mobile/node_modules/jimp-compact'));

const ROOT_DIR = path.resolve(__dirname, '../..');
const SOURCE_IMAGE = 'C:\\Users\\lenovo\\.gemini\\antigravity-ide\\brain\\4cc9d833-e913-4f25-847a-43f96fc76d1b\\.user_uploaded\\media_1792755711081.png';

async function main() {
  console.log('Reading master source:', SOURCE_IMAGE);
  const src = await Jimp.read(SOURCE_IMAGE);

  // 1. Precise optical bounding box for full logo
  // minX: 21, maxX: 612, minY: 46, maxY: 355
  // Add 4px clean breathing padding
  const fullX = Math.max(0, 21 - 4);
  const fullY = Math.max(0, 46 - 4);
  const fullW = Math.min(src.bitmap.width - fullX, (612 - 21 + 1) + 8);
  const fullH = Math.min(src.bitmap.height - fullY, (355 - 46 + 1) + 8);

  console.log(`Cropping full logo to optical bounds: x=${fullX}, y=${fullY}, w=${fullW}, h=${fullH}`);
  const trimmedFullTransparent = src.clone().crop(fullX, fullY, fullW, fullH);

  // Trimmed full on white
  const trimmedFullWhite = new Jimp(fullW, fullH, 0xFFFFFFFF);
  trimmedFullWhite.composite(trimmedFullTransparent, 0, 0);

  // 2. Optical bounding box for emblem mark (for collapsed sidebar & small badges)
  // minX: 83, maxX: 561, minY: 46, maxY: 278
  const markX = Math.max(0, 83 - 4);
  const markY = Math.max(0, 46 - 4);
  const markW = Math.min(src.bitmap.width - markX, (561 - 83 + 1) + 8);
  const markH = Math.min(src.bitmap.height - markY, (278 - 46 + 1) + 8);

  console.log(`Cropping emblem mark to optical bounds: x=${markX}, y=${markY}, w=${markW}, h=${markH}`);
  const trimmedMarkTransparent = src.clone().crop(markX, markY, markW, markH);

  // Trimmed mark on white
  const trimmedMarkWhite = new Jimp(markW, markH, 0xFFFFFFFF);
  trimmedMarkWhite.composite(trimmedMarkTransparent, 0, 0);

  // Target directories
  const adminImagesDir = path.join(ROOT_DIR, 'apps/admin/src/assets/images');
  const mobileAssetsDir = path.join(ROOT_DIR, 'apps/mobile/assets');

  const assets = [
    { name: 'trucks-logo-header.png', img: trimmedFullWhite },
    { name: 'trucks-logo-header-transparent.png', img: trimmedFullTransparent },
    { name: 'trucks-logo-mark.png', img: trimmedMarkWhite },
    { name: 'trucks-logo-mark-transparent.png', img: trimmedMarkTransparent },
  ];

  for (const asset of assets) {
    const adminPath = path.join(adminImagesDir, asset.name);
    const mobilePath = path.join(mobileAssetsDir, asset.name);

    await asset.img.writeAsync(adminPath);
    console.log(`Saved: ${adminPath} (${asset.img.bitmap.width}x${asset.img.bitmap.height})`);

    await asset.img.writeAsync(mobilePath);
    console.log(`Saved: ${mobilePath} (${asset.img.bitmap.width}x${asset.img.bitmap.height})`);
  }

  console.log('Derivative trimmed logo assets generated successfully.');
}

main().catch(err => {
  console.error('Error generating trimmed assets:', err);
  process.exit(1);
});
