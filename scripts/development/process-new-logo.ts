import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve(__dirname, '../..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PNG } = require(path.join(ROOT_DIR, 'apps/mobile/node_modules/pngjs'));

const USER_LOGO_PATH = 'C:\\Users\\lenovo\\.gemini\\antigravity-ide\\brain\\4cc9d833-e913-4f25-847a-43f96fc76d1b\\.user_uploaded\\media_1792751458760.png';


/**
 * Flood fill background transparency starting from borders
 */
function makeOuterBackgroundTransparent(src: any, threshold = 240): any {
  const width = src.width;
  const height = src.height;
  const dst = new PNG({ width, height });

  // Copy data over first
  for (let i = 0; i < src.data.length; i++) {
    dst.data[i] = src.data[i];
  }

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  function isWhiteLike(x: number, y: number): boolean {
    const idx = (width * y + x) << 2;
    const r = dst.data[idx];
    const g = dst.data[idx + 1];
    const b = dst.data[idx + 2];
    return r >= threshold && g >= threshold && b >= threshold;
  }

  // Seed with all border pixels that are white-like
  for (let x = 0; x < width; x++) {
    if (isWhiteLike(x, 0)) {
      queue.push(x, 0);
      visited[0 * width + x] = 1;
    }
    if (isWhiteLike(x, height - 1)) {
      queue.push(x, height - 1);
      visited[(height - 1) * width + x] = 1;
    }
  }
  for (let y = 0; y < height; y++) {
    if (isWhiteLike(0, y) && !visited[y * width + 0]) {
      queue.push(0, y);
      visited[y * width + 0] = 1;
    }
    if (isWhiteLike(width - 1, y) && !visited[y * width + (width - 1)]) {
      queue.push(width - 1, y);
      visited[y * width + (width - 1)] = 1;
    }
  }

  let head = 0;
  let filledCount = 0;
  while (head < queue.length) {
    const cx = queue[head++];
    const cy = queue[head++];

    const idx = (width * cy + cx) << 2;
    // Set to transparent
    dst.data[idx + 3] = 0;
    filledCount++;

    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nPos = ny * width + nx;
        if (!visited[nPos] && isWhiteLike(nx, ny)) {
          visited[nPos] = 1;
          queue.push(nx, ny);
        }
      }
    }
  }

  console.log(`Flood-filled ${filledCount} background pixels to transparent.`);
  return dst;
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

/**
 * Place logo onto square canvas of targetSize
 */
function createSquareLogo(srcLogo: any, targetSize = 1024, paddingPercent = 0.10, isTransparent = false): any {
  const canvas = new PNG({ width: targetSize, height: targetSize });

  // Initialize canvas background
  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const idx = (targetSize * y + x) << 2;
      if (isTransparent) {
        canvas.data[idx] = 0;
        canvas.data[idx + 1] = 0;
        canvas.data[idx + 2] = 0;
        canvas.data[idx + 3] = 0;
      } else {
        canvas.data[idx] = 255;
        canvas.data[idx + 1] = 255;
        canvas.data[idx + 2] = 255;
        canvas.data[idx + 3] = 255;
      }
    }
  }

  // Calculate scaled dimensions to fit inside targetSize with padding
  const maxW = Math.round(targetSize * (1 - paddingPercent * 2));
  const maxH = Math.round(targetSize * (1 - paddingPercent * 2));
  const aspect = srcLogo.width / srcLogo.height;

  let logoW = maxW;
  let logoH = Math.round(logoW / aspect);
  if (logoH > maxH) {
    logoH = maxH;
    logoW = Math.round(logoH * aspect);
  }

  const resized = resizeBilinear(srcLogo, logoW, logoH);
  const offsetX = Math.round((targetSize - logoW) / 2);
  const offsetY = Math.round((targetSize - logoH) / 2);

  for (let ly = 0; ly < logoH; ly++) {
    const cy = offsetY + ly;
    for (let lx = 0; lx < logoW; lx++) {
      const cx = offsetX + lx;
      const sIdx = (logoW * ly + lx) << 2;
      const cIdx = (targetSize * cy + cx) << 2;

      const sA = resized.data[sIdx + 3] / 255;
      if (sA <= 0) continue;

      const sR = resized.data[sIdx];
      const sG = resized.data[sIdx + 1];
      const sB = resized.data[sIdx + 2];

      const cR = canvas.data[cIdx];
      const cG = canvas.data[cIdx + 1];
      const cB = canvas.data[cIdx + 2];
      const cA = canvas.data[cIdx + 3] / 255;

      const outA = sA + cA * (1 - sA);
      if (outA > 0) {
        canvas.data[cIdx] = Math.round((sR * sA + cR * cA * (1 - sA)) / outA);
        canvas.data[cIdx + 1] = Math.round((sG * sA + cG * cA * (1 - sA)) / outA);
        canvas.data[cIdx + 2] = Math.round((sB * sA + cB * cA * (1 - sA)) / outA);
        canvas.data[cIdx + 3] = Math.round(outA * 255);
      }
    }
  }

  return canvas;
}

async function run() {
  console.log('Loading user uploaded logo from:', USER_LOGO_PATH);
  const rawBuf = fs.readFileSync(USER_LOGO_PATH);
  const originalHeaderPng = PNG.sync.read(rawBuf);
  console.log(`Original dimensions: ${originalHeaderPng.width}x${originalHeaderPng.height}`);

  console.log('Creating exterior-transparent header logo...');
  const transparentHeaderPng = makeOuterBackgroundTransparent(originalHeaderPng, 240);

  console.log('Creating 1024x1024 square logo on white background...');
  const squareWhitePng = createSquareLogo(originalHeaderPng, 1024, 0.08, false);

  console.log('Creating 1024x1024 square logo on transparent background...');
  const squareTransparentPng = createSquareLogo(transparentHeaderPng, 1024, 0.08, true);

  // Target directories
  const adminAssetsDir = path.join(ROOT_DIR, 'apps/admin/src/assets/images');
  const mobileAssetsDir = path.join(ROOT_DIR, 'apps/mobile/assets');

  const assets = [
    { name: 'trucks-logo-header.png', data: PNG.sync.write(originalHeaderPng) },
    { name: 'trucks-logo-header-transparent.png', data: PNG.sync.write(transparentHeaderPng) },
    { name: 'trucks-logo.png', data: PNG.sync.write(squareWhitePng) },
    { name: 'trucks-logo-transparent.png', data: PNG.sync.write(squareTransparentPng) },
  ];

  for (const asset of assets) {
    const adminDst = path.join(adminAssetsDir, asset.name);
    const mobileDst = path.join(mobileAssetsDir, asset.name);

    fs.writeFileSync(adminDst, asset.data);
    console.log(`Wrote: ${adminDst} (${asset.data.length} bytes)`);

    fs.writeFileSync(mobileDst, asset.data);
    console.log(`Wrote: ${mobileDst} (${asset.data.length} bytes)`);
  }

  console.log('All master logo assets created successfully!');
}

run().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
