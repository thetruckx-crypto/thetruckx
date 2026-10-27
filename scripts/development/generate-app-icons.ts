import fs from 'fs';
import path from 'path';

// In CommonJS TypeScript, __dirname and require are available globally
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PNG } = require(path.join(path.resolve(__dirname, '../..'), 'apps/mobile/node_modules/pngjs'));


interface PixelRGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Crop source PNG to tight content bounds
 */
function cropToContent(src: any): any {
  let minX = src.width;
  let maxX = 0;
  let minY = src.height;
  let maxY = 0;

  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const idx = (src.width * y + x) << 2;
      const r = src.data[idx];
      const g = src.data[idx + 1];
      const b = src.data[idx + 2];
      const a = src.data[idx + 3];
      const isContent = a > 20 && (r < 245 || g < 245 || b < 245);
      if (isContent) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropped = new PNG({ width: cropW, height: cropH });

  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const srcIdx = (src.width * (minY + y) + (minX + x)) << 2;
      const dstIdx = (cropW * y + x) << 2;
      cropped.data[dstIdx] = src.data[srcIdx];
      cropped.data[dstIdx + 1] = src.data[srcIdx + 1];
      cropped.data[dstIdx + 2] = src.data[srcIdx + 2];
      cropped.data[dstIdx + 3] = src.data[srcIdx + 3];
    }
  }

  return cropped;
}

/**
 * High-quality bilinear resampling of an image to target width and height
 */
function resizeBilinear(src: any, targetW: number, targetH: number): any {
  const dst = new PNG({ width: targetW, height: targetH });
  const scaleX = src.width / targetW;
  const scaleY = src.height / targetH;

  for (let y = 0; y < targetH; y++) {
    const srcY = y * scaleY;
    const y0 = Math.floor(srcY);
    const y1 = Math.min(src.height - 1, y0 + 1);
    const fy = srcY - y0;

    for (let x = 0; x < targetW; x++) {
      const srcX = x * scaleX;
      const x0 = Math.floor(srcX);
      const x1 = Math.min(src.width - 1, x0 + 1);
      const fx = srcX - x0;

      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const i00 = (src.width * y0 + x0) << 2;
      const i10 = (src.width * y0 + x1) << 2;
      const i01 = (src.width * y1 + x0) << 2;
      const i11 = (src.width * y1 + x1) << 2;

      const r = src.data[i00] * w00 + src.data[i10] * w10 + src.data[i01] * w01 + src.data[i11] * w11;
      const g = src.data[i00 + 1] * w00 + src.data[i10 + 1] * w10 + src.data[i01 + 1] * w01 + src.data[i11 + 1] * w11;
      const b = src.data[i00 + 2] * w00 + src.data[i10 + 2] * w10 + src.data[i01 + 2] * w01 + src.data[i11 + 2] * w11;
      const a = src.data[i00 + 3] * w00 + src.data[i10 + 3] * w10 + src.data[i01 + 3] * w01 + src.data[i11 + 3] * w11;

      const dstIdx = (targetW * y + x) << 2;
      dst.data[dstIdx] = Math.round(r);
      dst.data[dstIdx + 1] = Math.round(g);
      dst.data[dstIdx + 2] = Math.round(b);
      dst.data[dstIdx + 3] = Math.round(a);
    }
  }

  return dst;
}

interface GenerateOptions {
  size: number;
  logoPaddingPercent?: number; // e.g. 0.2 means logo width is (1 - 0.2*2) * size
  bgColor?: PixelRGBA;
  shape?: 'square' | 'circle' | 'squircle' | 'transparent';
  maskOutside?: boolean;
}

/**
 * Generate square icon with logo placed on background
 */
function createIcon(croppedLogo: any, options: GenerateOptions): any {
  const {
    size,
    logoPaddingPercent = 0.16,
    bgColor = { r: 255, g: 255, b: 255, a: 255 },
    shape = 'square',
    maskOutside = true,
  } = options;

  const canvas = new PNG({ width: size, height: size });

  // 1. Calculate target dimensions for the logo maintaining aspect ratio
  const maxLogoW = Math.round(size * (1 - logoPaddingPercent * 2));
  const maxLogoH = Math.round(size * (1 - logoPaddingPercent * 2) * 0.75); // max vertical span
  const aspect = croppedLogo.width / croppedLogo.height;

  let logoW = maxLogoW;
  let logoH = Math.round(logoW / aspect);
  if (logoH > maxLogoH) {
    logoH = maxLogoH;
    logoW = Math.round(logoH * aspect);
  }

  const resizedLogo = resizeBilinear(croppedLogo, logoW, logoH);
  const offsetX = Math.round((size - logoW) / 2);
  const offsetY = Math.round((size - logoH) / 2);

  // 2. Render background and shape mask
  const center = size / 2;
  const radius = size / 2;
  const cornerRadius = size * 0.22; // For squircle

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;

      let shapeAlpha = 1.0;
      if (shape === 'circle') {
        const dist = Math.hypot(x + 0.5 - center, y + 0.5 - center);
        if (dist > radius) {
          shapeAlpha = 0;
        } else if (dist > radius - 1) {
          shapeAlpha = radius - dist;
        }
      } else if (shape === 'squircle') {
        // Distance to rounded rectangle
        const dx = Math.max(0, Math.abs(x + 0.5 - center) - (center - cornerRadius));
        const dy = Math.max(0, Math.abs(y + 0.5 - center) - (center - cornerRadius));
        const dist = Math.hypot(dx, dy);
        if (dist > cornerRadius) {
          shapeAlpha = 0;
        } else if (dist > cornerRadius - 1) {
          shapeAlpha = cornerRadius - dist;
        }
      } else if (shape === 'transparent') {
        shapeAlpha = 0;
      }

      if (shape === 'transparent') {
        canvas.data[idx] = 0;
        canvas.data[idx + 1] = 0;
        canvas.data[idx + 2] = 0;
        canvas.data[idx + 3] = 0;
      } else {
        canvas.data[idx] = bgColor.r;
        canvas.data[idx + 1] = bgColor.g;
        canvas.data[idx + 2] = bgColor.b;
        canvas.data[idx + 3] = Math.round(bgColor.a * (maskOutside ? shapeAlpha : 1.0));
      }
    }
  }

  // 3. Composite resized logo onto canvas
  for (let ly = 0; ly < logoH; ly++) {
    const cy = offsetY + ly;
    if (cy < 0 || cy >= size) continue;

    for (let lx = 0; lx < logoW; lx++) {
      const cx = offsetX + lx;
      if (cx < 0 || cx >= size) continue;

      const logoIdx = (logoW * ly + lx) << 2;
      const canvasIdx = (size * cy + cx) << 2;

      const logoA = resizedLogo.data[logoIdx + 3] / 255;
      if (logoA <= 0) continue;

      const logoR = resizedLogo.data[logoIdx];
      const logoG = resizedLogo.data[logoIdx + 1];
      const logoB = resizedLogo.data[logoIdx + 2];

      const curR = canvas.data[canvasIdx];
      const curG = canvas.data[canvasIdx + 1];
      const curB = canvas.data[canvasIdx + 2];
      const curA = canvas.data[canvasIdx + 3] / 255;

      // Standard Porter-Duff source-over blending
      const outA = logoA + curA * (1 - logoA);
      if (outA > 0) {
        canvas.data[canvasIdx] = Math.round((logoR * logoA + curR * curA * (1 - logoA)) / outA);
        canvas.data[canvasIdx + 1] = Math.round((logoG * logoA + curG * curA * (1 - logoA)) / outA);
        canvas.data[canvasIdx + 2] = Math.round((logoB * logoA + curB * curA * (1 - logoA)) / outA);
        canvas.data[canvasIdx + 3] = Math.round(outA * 255);
      }
    }
  }

  // If circular or squircle mask applies, ensure anti-aliased perimeter masking
  if (shape === 'circle' || shape === 'squircle') {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (size * y + x) << 2;
        let shapeAlpha = 1.0;
        if (shape === 'circle') {
          const dist = Math.hypot(x + 0.5 - center, y + 0.5 - center);
          if (dist > radius) shapeAlpha = 0;
          else if (dist > radius - 1) shapeAlpha = radius - dist;
        } else if (shape === 'squircle') {
          const dx = Math.max(0, Math.abs(x + 0.5 - center) - (center - cornerRadius));
          const dy = Math.max(0, Math.abs(y + 0.5 - center) - (center - cornerRadius));
          const dist = Math.hypot(dx, dy);
          if (dist > cornerRadius) shapeAlpha = 0;
          else if (dist > cornerRadius - 1) shapeAlpha = cornerRadius - dist;
        }
        canvas.data[idx + 3] = Math.round(canvas.data[idx + 3] * shapeAlpha);
      }
    }
  }

  return canvas;
}

async function main() {
  console.log('====================================================');
  console.log('       NECL APP ICON GENERATOR & SYNC TOOL          ');
  console.log('====================================================');

  const rootDir = path.resolve(__dirname, '../..');
  const logoPath = path.join(rootDir, 'apps/mobile/assets/trucks-logo.png');

  if (!fs.existsSync(logoPath)) {
    console.error('Source logo not found at:', logoPath);
    process.exit(1);
  }

  console.log('[1/5] Reading master logo:', logoPath);
  const logoBuffer = fs.readFileSync(logoPath);
  const masterPng = PNG.sync.read(logoBuffer);
  console.log(`      Dimensions: ${masterPng.width}x${masterPng.height}`);

  console.log('[2/5] Cropping logo to content bounding box...');
  const croppedLogo = cropToContent(masterPng);
  console.log(`      Cropped Dimensions: ${croppedLogo.width}x${croppedLogo.height}`);

  // 1. Expo Master App Icon (1024x1024) - Clean crisp white background for iOS & Android
  console.log('[3/5] Generating Mobile App Icons...');
  const icon1024 = createIcon(croppedLogo, {
    size: 1024,
    logoPaddingPercent: 0.16, // Logo spans ~68% of 1024 = 696px (well within safe bounds)
    bgColor: { r: 255, g: 255, b: 255, a: 255 },
    shape: 'square',
  });
  const iconPath = path.join(rootDir, 'apps/mobile/assets/icon.png');
  fs.writeFileSync(iconPath, PNG.sync.write(icon1024));
  console.log('      ✅ Created:', iconPath);

  // 2. Android Adaptive Icon Foreground (1024x1024) - Centered within 66% safe zone
  const adaptiveIcon1024 = createIcon(croppedLogo, {
    size: 1024,
    logoPaddingPercent: 0.20, // Inside 60% safe circle
    bgColor: { r: 255, g: 255, b: 255, a: 255 },
    shape: 'square',
  });
  const adaptiveIconPath = path.join(rootDir, 'apps/mobile/assets/adaptive-icon.png');
  fs.writeFileSync(adaptiveIconPath, PNG.sync.write(adaptiveIcon1024));
  console.log('      ✅ Created:', adaptiveIconPath);

  // 3. Mobile Web Favicon (192x192)
  const favicon192 = createIcon(croppedLogo, {
    size: 192,
    logoPaddingPercent: 0.12,
    bgColor: { r: 255, g: 255, b: 255, a: 255 },
    shape: 'squircle',
  });
  const mobileFaviconPath = path.join(rootDir, 'apps/mobile/assets/favicon.png');
  fs.writeFileSync(mobileFaviconPath, PNG.sync.write(favicon192));
  console.log('      ✅ Created:', mobileFaviconPath);

  // 4. Android Native Mipmap Density Icons
  console.log('[4/5] Generating Android Native Mipmap Launchers...');
  const mipmapConfigs = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
  ];

  const androidResDir = path.join(rootDir, 'apps/mobile/android/app/src/main/res');
  if (fs.existsSync(androidResDir)) {
    for (const cfg of mipmapConfigs) {
      const targetDir = path.join(androidResDir, cfg.dir);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Standard launcher icon (Squircle / rounded rectangle)
      const standardIcon = createIcon(croppedLogo, {
        size: cfg.size,
        logoPaddingPercent: 0.12,
        bgColor: { r: 255, g: 255, b: 255, a: 255 },
        shape: 'squircle',
      });
      fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), PNG.sync.write(standardIcon));

      // Circular launcher icon (Round)
      const roundIcon = createIcon(croppedLogo, {
        size: cfg.size,
        logoPaddingPercent: 0.18, // Slightly more padding to fit cleanly in circle
        bgColor: { r: 255, g: 255, b: 255, a: 255 },
        shape: 'circle',
      });
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), PNG.sync.write(roundIcon));

      console.log(`      ✅ Updated ${cfg.dir} (size: ${cfg.size}px)`);
    }
  }

  // 5. Admin Panel Favicon & Touch Icons
  console.log('[5/5] Generating Admin Portal App Icons...');
  const adminPublicDir = path.join(rootDir, 'apps/admin/public');
  if (!fs.existsSync(adminPublicDir)) {
    fs.mkdirSync(adminPublicDir, { recursive: true });
  }

  // Admin Favicon PNG (64x64)
  const adminFavicon64 = createIcon(croppedLogo, {
    size: 64,
    logoPaddingPercent: 0.10,
    bgColor: { r: 255, g: 255, b: 255, a: 255 },
    shape: 'squircle',
  });
  const adminFaviconPath = path.join(adminPublicDir, 'favicon.png');
  fs.writeFileSync(adminFaviconPath, PNG.sync.write(adminFavicon64));
  console.log('      ✅ Created Admin Favicon:', adminFaviconPath);

  // Admin Apple Touch Icon (180x180)
  const adminTouchIcon = createIcon(croppedLogo, {
    size: 180,
    logoPaddingPercent: 0.14,
    bgColor: { r: 255, g: 255, b: 255, a: 255 },
    shape: 'square',
  });
  const adminTouchPath = path.join(adminPublicDir, 'apple-touch-icon.png');
  fs.writeFileSync(adminTouchPath, PNG.sync.write(adminTouchIcon));
  console.log('      ✅ Created Admin Apple Touch Icon:', adminTouchPath);

  console.log('\n====================================================');
  console.log('🎉 APP ICONS SUCCESSFULLY IMPLEMENTED ACROSS ALL APPS');
  console.log('====================================================');
}

main().catch(err => {
  console.error('Fatal error generating app icons:', err);
  process.exit(1);
});

export {};

