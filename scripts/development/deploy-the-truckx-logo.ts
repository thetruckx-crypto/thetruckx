import path from 'path';
import fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Jimp = require(path.join(__dirname, '../../apps/mobile/node_modules/jimp-compact'));

const ROOT_DIR = path.resolve(__dirname, '../..');
const NEW_LOGO_PATH = 'C:\\Users\\lenovo\\.gemini\\antigravity-ide\\brain\\4cc9d833-e913-4f25-847a-43f96fc76d1b\\.user_uploaded\\media_1792755711081.png';

async function main() {
  console.log('Loading newly provided THE TRUCKX logo from:', NEW_LOGO_PATH);
  const srcImg = await Jimp.read(NEW_LOGO_PATH);
  const { width, height } = srcImg.bitmap;
  console.log(`Original dimensions: ${width}x${height}`);

  // 1. Transparent Header Logo (exact source with preserved native transparency)
  const transparentHeader = srcImg.clone();

  // 2. White-backed Header Logo (composite over pure white background)
  const whiteHeader = new Jimp(width, height, 0xFFFFFFFF);
  whiteHeader.composite(srcImg, 0, 0);

  // 3. Square 1024x1024 Logo (Transparent)
  const squareTransparent = new Jimp(1024, 1024, 0x00000000);
  // Scale logo to fit nicely in 1024 box (~880 max width, maintaining aspect ratio)
  const targetW = 880;
  const targetH = Math.round(targetW * (height / width));
  const scaledTransparent = srcImg.clone().resize(targetW, targetH, Jimp.RESIZE_BICUBIC);
  const offX = Math.round((1024 - targetW) / 2);
  const offY = Math.round((1024 - targetH) / 2);
  squareTransparent.composite(scaledTransparent, offX, offY);

  // 4. Square 1024x1024 Logo (White Background)
  const squareWhite = new Jimp(1024, 1024, 0xFFFFFFFF);
  squareWhite.composite(scaledTransparent, offX, offY);

  // Target directories
  const adminImagesDir = path.join(ROOT_DIR, 'apps/admin/src/assets/images');
  const mobileAssetsDir = path.join(ROOT_DIR, 'apps/mobile/assets');

  const targets = [
    { name: 'trucks-logo-header-transparent.png', img: transparentHeader },
    { name: 'trucks-logo-header.png', img: whiteHeader },
    { name: 'trucks-logo-transparent.png', img: squareTransparent },
    { name: 'trucks-logo.png', img: squareWhite },
  ];

  for (const t of targets) {
    const adminPath = path.join(adminImagesDir, t.name);
    const mobilePath = path.join(mobileAssetsDir, t.name);

    await t.img.writeAsync(adminPath);
    console.log(`✅ Deployed: ${adminPath}`);

    await t.img.writeAsync(mobilePath);
    console.log(`✅ Deployed: ${mobilePath}`);
  }

  console.log('\n======================================================');
  console.log('🎉 THE TRUCKX OFFICIAL LOGO SUCCESSFULLY DEPLOYED');
  console.log('======================================================');
}

main().catch(err => {
  console.error('Fatal error deploying THE TRUCKX logo:', err);
  process.exit(1);
});
