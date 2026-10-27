import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { supabase, ensureMobileSession } from '../supabase';

// Base64 lookup table for cross-platform Uint8Array decoding
const b64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const b64Lookup = new Uint8Array(256);
for (let i = 0; i < b64Chars.length; i++) {
  b64Lookup[b64Chars.charCodeAt(i)] = i;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const len = cleanBase64.length;
  let bufferLength = len * 0.75;
  if (cleanBase64.charAt(len - 1) === '=') {
    bufferLength--;
    if (cleanBase64.charAt(len - 2) === '=') {
      bufferLength--;
    }
  }

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const enc1 = b64Lookup[cleanBase64.charCodeAt(i)];
    const enc2 = b64Lookup[cleanBase64.charCodeAt(i + 1)];
    const enc3 = b64Lookup[cleanBase64.charCodeAt(i + 2)];
    const enc4 = b64Lookup[cleanBase64.charCodeAt(i + 3)];

    bytes[p++] = (enc1 << 2) | (enc2 >> 4);
    if (enc3 !== 64 && p < bufferLength) {
      bytes[p++] = ((enc2 & 15) << 4) | (enc3 >> 2);
    }
    if (enc4 !== 64 && p < bufferLength) {
      bytes[p++] = ((enc3 & 3) << 6) | enc4;
    }
  }
  return bytes;
}

export const STORAGE_BUCKET = 'client-documents';

/**
 * Normalizes file extension to a valid MIME type accepted by Supabase Storage.
 */
export function getStandardMimeType(fileNameOrExt: string, fallbackMime?: string): string {
  const ext = fileNameOrExt.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      if (fallbackMime && fallbackMime !== 'text/plain') return fallbackMime;
      return 'application/pdf';
  }
}

export interface UploadDocumentParams {
  uri?: string;
  blob?: Blob | ArrayBuffer | Uint8Array;
  fileName: string;
  fileSize?: string;
  mimeType?: string;
  storagePath: string;
}

export interface UploadDocumentResult {
  success: boolean;
  storagePath: string;
  fileUrl?: string;
  error?: string;
}

export const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx'];

/**
 * Universal, rock-solid document uploader for React Native mobile & web.
 * Accurately reads binary bytes into Uint8Array and uploads to Supabase Storage with retries.
 */
export async function uploadDocumentToStorage(
  params: UploadDocumentParams
): Promise<UploadDocumentResult> {
  const { uri, blob, fileName, mimeType, storagePath } = params;
  const targetMime = getStandardMimeType(fileName, mimeType);

  // 1. File extension validation
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext && !ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      success: false,
      storagePath: '',
      error: `Unsupported file format (.${ext}). Only PDF, JPG, PNG, WEBP, and DOC files are permitted.`,
    };
  }

  try {
    await ensureMobileSession();

    let uploadData: Uint8Array | ArrayBuffer | null = null;

    if (blob instanceof Uint8Array || blob instanceof ArrayBuffer) {
      uploadData = blob;
    } else if (Platform.OS === 'web') {
      if (blob && typeof (blob as any).arrayBuffer === 'function') {
        const ab = await (blob as any).arrayBuffer();
        uploadData = new Uint8Array(ab);
      } else if (uri) {
        const res = await fetch(uri);
        const ab = await res.arrayBuffer();
        uploadData = new Uint8Array(ab);
      }
    } else {
      // Native Android / iOS
      if (uri) {
        if (uri.startsWith('data:')) {
          const base64Data = uri.split(',')[1] || uri;
          uploadData = base64ToUint8Array(base64Data);
        } else {
          try {
            // Expo FileSystem: read directly as base64 string
            const base64 = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            uploadData = base64ToUint8Array(base64);
          } catch (fsErr: any) {
            console.warn('FileSystem read error, fallback to fetch blob:', fsErr);
            const res = await fetch(uri);
            const ab = await res.arrayBuffer();
            uploadData = new Uint8Array(ab);
          }
        }
      } else if (blob && typeof (blob as any).arrayBuffer === 'function') {
        const ab = await (blob as any).arrayBuffer();
        uploadData = new Uint8Array(ab);
      }
    }

    if (!uploadData || (uploadData as Uint8Array).length === 0) {
      console.error('Failed to extract binary content for upload:', fileName, uri);
      return {
        success: false,
        storagePath: '',
        error: `Could not read file data for ${fileName}. Please re-select the document.`,
      };
    }

    // 2. File size validation (15 MB maximum)
    const byteLength = uploadData.byteLength || (uploadData as Uint8Array).length;
    if (byteLength > MAX_UPLOAD_SIZE_BYTES) {
      const sizeMb = (byteLength / (1024 * 1024)).toFixed(1);
      return {
        success: false,
        storagePath: '',
        error: `File size (${sizeMb} MB) exceeds maximum permitted limit of 15 MB. Please compress or select a smaller file.`,
      };
    }

    // Clean storage path
    const cleanPath = storagePath.replace(/^\/+/, '');

    // 3. Upload with automatic retry on transient failure
    let uploadResult: any = null;
    let lastError: any = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(cleanPath, uploadData, {
            contentType: targetMime,
            upsert: true,
          });

        if (!error && data) {
          uploadResult = data;
          break;
        }
        lastError = error;
      } catch (e: any) {
        lastError = e;
      }

      if (attempt < maxRetries) {
        // Wait 500ms before retry
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }

    if (!uploadResult) {
      console.error('Supabase storage upload failed after retries:', lastError?.message);
      return {
        success: false,
        storagePath: '',
        error: `Storage upload failed: ${lastError?.message || 'Network error'}`,
      };
    }

    const uploadedPath = uploadResult?.path || cleanPath;

    // Generate valid signed URL (valid for 7 days)
    const { data: signData } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(uploadedPath, 86400 * 7);

    return {
      success: true,
      storagePath: uploadedPath,
      fileUrl: signData?.signedUrl || uploadedPath,
    };
  } catch (err: any) {
    console.error('uploadDocumentToStorage exception:', err);
    return {
      success: false,
      storagePath: '',
      error: err.message || 'An unexpected error occurred during file upload.',
    };
  }
}

/**
 * Resolves a secure signed URL for previewing or downloading a stored document.
 */
export async function getSecureDocumentSignedUrl(storagePathOrUrl: string): Promise<string | null> {
  if (!storagePathOrUrl) return null;

  // If already a valid signed URL with token
  if (
    (storagePathOrUrl.startsWith('http://') || storagePathOrUrl.startsWith('https://')) &&
    storagePathOrUrl.includes('token=')
  ) {
    return storagePathOrUrl;
  }

  try {
    await ensureMobileSession();

    // Extract path if it is a full storage URL
    let cleanPath = storagePathOrUrl.replace(/^\/+/, '');
    if (cleanPath.includes('/object/public/')) {
      cleanPath = cleanPath.split('/object/public/')[1];
      const parts = cleanPath.split('/');
      parts.shift(); // remove bucket
      cleanPath = parts.join('/');
    } else if (cleanPath.includes('/object/sign/')) {
      cleanPath = cleanPath.split('/object/sign/')[1].split('?')[0];
      const parts = cleanPath.split('/');
      parts.shift(); // remove bucket
      cleanPath = parts.join('/');
    } else if (cleanPath.startsWith(`${STORAGE_BUCKET}/`)) {
      cleanPath = cleanPath.replace(`${STORAGE_BUCKET}/`, '');
    }

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(cleanPath, 86400); // 24 hours

    if (error || !data?.signedUrl) {
      console.warn('Could not generate signed URL:', error?.message);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.warn('getSecureDocumentSignedUrl exception:', err);
    return null;
  }
}
