import path from 'path';
import fs from 'fs';

const ROOT_DIR = path.resolve(__dirname, '../..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Jimp = require(path.join(ROOT_DIR, 'apps/mobile/node_modules/jimp-compact'));

const INPUT_IMAGE = 'C:\\Users\\lenovo\\.gemini\\antigravity-ide\\brain\\4cc9d833-e913-4f25-847a-43f96fc76d1b\\.user_uploaded\\media_1792754393381.jpg';


const ORANGE = { r: 250, g: 87, b: 0, a: 255 }; // Exact brand orange

async function run() {
  console.log('Loading input icon from:', INPUT_IMAGE);
  const srcImg = await Jimp.read(INPUT_IMAGE);
  const width = srcImg.bitmap.width;
  const height = srcImg.bitmap.height;
  console.log(`Original dimensions: ${width}x${height}`);

  // 1. Create Full-Bleed Square (corners filled with matching orange) - Perfect for iOS and master icon.png
  console.log('Creating full-bleed square master icon (1024x1024)...');
  const fullBleedSquare = srcImg.clone();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = Jimp.intToRGBA(fullBleedSquare.getPixelColor(x, y));
      // Detect black corners outside the squircle
      if (c.r < 40 && c.g < 40 && c.b < 40) {
        fullBleedSquare.setPixelColor(Jimp.rgbaToInt(ORANGE.r, ORANGE.g, ORANGE.b, 255), x, y);
      } else if (c.r < 180 && c.g < 80 && c.b < 30) {
        // Blend transition edge smoothly to pure orange
        const alpha = c.r / 250;
        const blendR = Math.round(ORANGE.r * (1 - alpha) + c.r * alpha);
        const blendG = Math.round(ORANGE.g * (1 - alpha) + c.g * alpha);
        const blendB = Math.round(ORANGE.b * (1 - alpha) + c.b * alpha);
        fullBleedSquare.setPixelColor(Jimp.rgbaToInt(blendR, blendG, blendB, 255), x, y);
      }
    }
  }

  // 2. Create Transparent-Corner Squircle Icon - for web favicons & standard ic_launcher.png
  console.log('Creating transparent-corner squircle icon (1024x1024)...');
  const squircleTransparent = srcImg.clone();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = Jimp.intToRGBA(squircleTransparent.getPixelColor(x, y));
      if (c.r < 30 && c.g < 30 && c.b < 30) {
        squircleTransparent.setPixelColor(0, x, y); // full transparent
      } else if (c.r < 180 && c.g < 80 && c.b < 30) {
        // Anti-aliased boundary
        const a = Math.min(255, Math.max(0, Math.round((c.r / 240) * 255)));
        squircleTransparent.setPixelColor(Jimp.rgbaToInt(c.r, c.g, c.b, a), x, y);
      }
    }
  }

  // 3. Create Android Adaptive Icon Foreground (1024x1024)
  // Scaled to fit within 66% safe zone circle (diameter ~675px) so no Android OEM cuts the emblem
  console.log('Creating Android Adaptive Icon foreground...');
  const adaptiveForeground = new Jimp(1024, 1024, 0); // Transparent canvas
  const scaledIcon = squircleTransparent.clone().resize(720, 720, Jimp.RESIZE_BICUBIC);
  const offsetX = Math.round((1024 - 720) / 2);
  const offsetY = Math.round((1024 - 720) / 2);
  adaptiveForeground.composite(scaledIcon, offsetX, offsetY);

  // 4. Save Mobile Main Icons
  const mobileAssetsDir = path.join(ROOT_DIR, 'apps/mobile/assets');
  
  // apps/mobile/assets/icon.png
  await fullBleedSquare.writeAsync(path.join(mobileAssetsDir, 'icon.png'));
  console.log('✅ Generated apps/mobile/assets/icon.png');

  // apps/mobile/assets/adaptive-icon.png
  await adaptiveForeground.writeAsync(path.join(mobileAssetsDir, 'adaptive-icon.png'));
  console.log('✅ Generated apps/mobile/assets/adaptive-icon.png');

  // apps/mobile/assets/favicon.png (192x192)
  const mobileFavicon = squircleTransparent.clone().resize(192, 192, Jimp.RESIZE_BICUBIC);
  await mobileFavicon.writeAsync(path.join(mobileAssetsDir, 'favicon.png'));
  console.log('✅ Generated apps/mobile/assets/favicon.png');

  // 5. Generate Android Native Mipmap Density Launchers
  const mipmapConfigs = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
  ];

  const androidResDir = path.join(ROOT_DIR, 'apps/mobile/android/app/src/main/res');
  if (fs.existsSync(androidResDir)) {
    console.log('Generating Android native mipmap density assets...');
    for (const cfg of mipmapConfigs) {
      const targetDir = path.join(androidResDir, cfg.dir);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // ic_launcher.png (Squircle)
      const standardLauncher = squircleTransparent.clone().resize(cfg.size, cfg.size, Jimp.RESIZE_BICUBIC);
      await standardLauncher.writeAsync(path.join(targetDir, 'ic_launcher.png'));

      // ic_launcher_round.png (Circle)
      const roundLauncher = fullBleedSquare.clone().resize(cfg.size, cfg.size, Jimp.RESIZE_BICUBIC);
      const center = cfg.size / 2;
      const radius = cfg.size / 2;
      for (let y = 0; y < cfg.size; y++) {
        for (let x = 0; x < cfg.size; x++) {
          const dist = Math.hypot(x + 0.5 - center, y + 0.5 - center);
          if (dist > radius) {
            roundLauncher.setPixelColor(0, x, y);
          } else if (dist > radius - 1) {
            const alpha = Math.min(255, Math.max(0, Math.round((radius - dist) * 255)));
            const cur = Jimp.intToRGBA(roundLauncher.getPixelColor(x, y));
            roundLauncher.setPixelColor(Jimp.rgbaToInt(cur.r, cur.g, cur.b, alpha), x, y);
          }
        }
      }
      await roundLauncher.writeAsync(path.join(targetDir, 'ic_launcher_round.png'));
      console.log(`✅ Updated ${cfg.dir} (size: ${cfg.size}px)`);
    }
  }

  // 6. Admin Panel Favicon & Apple Touch Icon
  console.log('Generating Admin portal app icons...');
  const adminPublicDir = path.join(ROOT_DIR, 'apps/admin/public');

  // favicon.png (64x64)
  const adminFavicon64 = squircleTransparent.clone().resize(64, 64, Jimp.RESIZE_BICUBIC);
  const adminFaviconPath = path.join(adminPublicDir, 'favicon.png');
  await adminFavicon64.writeAsync(adminFaviconPath);
  console.log('✅ Generated apps/admin/public/favicon.png');

  // apple-touch-icon.png (180x180)
  const adminTouchIcon = fullBleedSquare.clone().resize(180, 180, Jimp.RESIZE_BICUBIC);
  const adminTouchPath = path.join(adminPublicDir, 'apple-touch-icon.png');
  await adminTouchIcon.writeAsync(adminTouchPath);
  console.log('✅ Generated apps/admin/public/apple-touch-icon.png');

  // favicon.ico (64x64 multi-format icon)
  const pngBuf = await adminFavicon64.getBufferAsync(Jimp.MIME_PNG);
  const icoHeader = Buffer.alloc(22);
  icoHeader.writeUInt16LE(0, 0); // reserved
  icoHeader.writeUInt16LE(1, 2); // ICO
  icoHeader.writeUInt16LE(1, 4); // 1 image
  icoHeader.writeUInt8(64, 6);   // width
  icoHeader.writeUInt8(64, 7);   // height
  icoHeader.writeUInt8(0, 8);    // color count
  icoHeader.writeUInt8(0, 9);    // reserved
  icoHeader.writeUInt16LE(1, 10); // planes
  icoHeader.writeUInt16LE(32, 12); // bpp
  icoHeader.writeUInt32LE(pngBuf.length, 14); // data size
  icoHeader.writeUInt32LE(22, 18); // offset
  const icoBuf = Buffer.concat([icoHeader, pngBuf]);
  fs.writeFileSync(path.join(adminPublicDir, 'favicon.ico'), icoBuf);
  console.log('✅ Generated apps/admin/public/favicon.ico');

  console.log('\n======================================================');
  console.log('🎉 APP LAUNCHER ICONS SUCCESSFULLY GENERATED & DEPLOYED');
  console.log('======================================================');
}

run().catch(err => {
  console.error('Fatal error generating app launcher icons:', err);
  process.exit(1);
});
