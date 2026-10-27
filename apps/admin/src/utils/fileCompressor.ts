/**
 * NECL Automatic File & Image Compression Utility
 * 
 * Provides intelligent, high-fidelity compression for images (JPEG, PNG, WEBP)
 * preserving text clarity for PAN, GSTIN, RC certificates, signatures, and stamps,
 * while drastically minimizing storage requirements and network upload times.
 */

export interface CompressionOptions {
  maxDimension?: number;
  quality?: number;
  minSizeThresholdBytes?: number;
  mimeType?: 'image/jpeg' | 'image/webp' | 'image/png';
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number; // e.g. 0.35 = 65% reduction
  wasCompressed: boolean;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxDimension: 1920, // Crisp resolution for high-DPI document text
  quality: 0.82,       // Optimal perceptual quality vs size trade-off
  minSizeThresholdBytes: 250 * 1024, // Don't re-compress files already under 250 KB
  mimeType: 'image/jpeg',
};

/**
 * Checks if a file is an optimizable raster image
 */
export function isCompressibleImage(file: File): boolean {
  return /^(image\/jpeg|image\/png|image\/webp|image\/jpg)$/i.test(file.type);
}

/**
 * Formats bytes to human-readable string (KB, MB)
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Automatically optimizes an image file using browser-native HTML5 Canvas.
 * Non-image files (e.g. PDF) or images smaller than the threshold are returned as-is.
 */
export async function compressImageFile(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = file.size;

  // 1. If not a compressible image or file is already lightweight, bypass
  if (!isCompressibleImage(file) || originalSize <= (opts.minSizeThresholdBytes || 250 * 1024)) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
      wasCompressed: false,
    };
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      const maxDim = opts.maxDimension || 1920;

      // Calculate scaled dimensions while preserving exact aspect ratio
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({
          file,
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1,
          wasCompressed: false,
        });
        return;
      }

      // Fill white background to prevent black background when converting transparent PNG to JPEG
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // High quality bicubic resampling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const targetMime = opts.mimeType || 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= originalSize) {
            // If compressed version is somehow larger or failed, retain original
            resolve({
              file,
              originalSize,
              compressedSize: originalSize,
              compressionRatio: 1,
              wasCompressed: false,
            });
            return;
          }

          // Build clean filename matching target format
          let targetName = file.name;
          if (targetMime === 'image/jpeg' && !/\.(jpe?g)$/i.test(targetName)) {
            targetName = targetName.replace(/\.[^/.]+$/, '') + '.jpg';
          }

          const compressedFile = new File([blob], targetName, {
            type: targetMime,
            lastModified: Date.now(),
          });

          const compressedSize = compressedFile.size;
          const compressionRatio = compressedSize / originalSize;

          console.log(
            `[fileCompressor] Compressed "${file.name}": ${formatBytes(originalSize)} -> ${formatBytes(compressedSize)} (${Math.round((1 - compressionRatio) * 100)}% reduction)`
          );

          resolve({
            file: compressedFile,
            originalSize,
            compressedSize,
            compressionRatio,
            wasCompressed: true,
          });
        },
        targetMime,
        opts.quality || 0.82
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        file,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
        wasCompressed: false,
      });
    };

    img.src = objectUrl;
  });
}

/**
 * Convenience helper to compress a file if it is an image, or return it untouched.
 */
export async function optimizeFileForUpload(
  file: File,
  options?: CompressionOptions
): Promise<File> {
  const result = await compressImageFile(file, options);
  return result.file;
}
