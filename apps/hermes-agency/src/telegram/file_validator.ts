// Anti-hardcoded: all config via process.env
// Hermes Agency — File size and MIME type validation for uploads

import * as fs from 'node:fs';

// ── Env vars ─────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = parseInt(process.env['HERMES_MAX_FILE_SIZE'] ?? '20971520', 10); // 20MB default

// ── Allowed MIME types ────────────────────────────────────────────────────────
// Voice: Telegram sends .ogg (Opus) or .mp3
// Photo: JPEG, PNG, GIF, WebP, HEIF
const ALLOWED_MIME_TYPES = new Set<string>([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  // Voice/audio
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/aac',
  'audio/x-opus+ogg', // Telegram Opus
  // Video
  'video/mp4',
]);

// Magic bytes → MIME type map (first few bytes of file)
const MAGIC_BYTES: Array<{ bytes: number[]; mask: number[]; mime: string }> = [
  { bytes: [0xFF, 0xD8, 0xFF], mask: [0xFF, 0xFF, 0xFF], mime: 'image/jpeg' },
  { bytes: [0x89, 0x50, 0x4E, 0x47], mask: [0xFF, 0xFF, 0xFF, 0xFF], mime: 'image/png' },
  { bytes: [0x47, 0x49, 0x46, 0x38], mask: [0xFF, 0xFF, 0xFF, 0xFF], mime: 'image/gif' },
  { bytes: [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50], mask: [0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF], mime: 'image/webp' },
  { bytes: [0x4F, 0x67, 0x67, 0x53], mask: [0xFF, 0xFF, 0xFF, 0xFF], mime: 'audio/ogg' },
  { bytes: [0x66, 0x4C, 0x61, 0x43], mask: [0xFF, 0xFF, 0xFF, 0xFF], mime: 'audio/mp3' }, // FLAC
  { bytes: [0x52, 0x49, 0x46, 0x46], mask: [0xFF, 0xFF, 0xFF, 0xFF], mime: 'audio/wav' }, // RIFF
  // MP3 variants (ID3v2 and untagged)
  { bytes: [0xFF, 0xFB], mask: [0xFF, 0xFF], mime: 'audio/mp3' },
  { bytes: [0xFF, 0xFA], mask: [0xFF, 0xFF], mime: 'audio/mp3' },
  { bytes: [0x49, 0x44, 0x33], mask: [0xFF, 0xFF, 0xFF], mime: 'audio/mp3' }, // ID3v2
  // MP4 video
  { bytes: [0x00, 0x00, 0x00], mask: [0xFF, 0xFF, 0xFF], mime: 'video/mp4' },
];

/**
 * Detect MIME type from file magic bytes.
 */
function detectMimeFromMagic(filePath: string): string | null {
  try {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    for (const { bytes, mask, mime } of MAGIC_BYTES) {
      let match = true;
      for (let i = 0; i < bytes.length; i++) {
        const bufByte = buffer[i] ?? 0;
        const maskByte = mask[i] ?? 0;
        if ((bufByte & maskByte) !== bytes[i]!) {
          match = false;
          break;
        }
      }
      if (match) return mime;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate file size and MIME type.
 * Returns { valid: true } or { valid: false, reason: string }
 */
export function validateFile(filePath: string): { valid: true } | { valid: false; reason: string } {
  // Check size
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      const maxMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
      return { valid: false, reason: `Ficheiro demasiado grande (max ${maxMB}MB)` };
    }
    if (stats.size === 0) {
      return { valid: false, reason: 'Ficheiro vazio' };
    }
  } catch (err) {
    return { valid: false, reason: `Não foi possível ler o ficheiro` };
  }

  // Check MIME via magic bytes
  const detectedMime = detectMimeFromMagic(filePath);
  if (!detectedMime) {
    return { valid: false, reason: 'Tipo de ficheiro não suportado' };
  }

  if (!ALLOWED_MIME_TYPES.has(detectedMime)) {
    return { valid: false, reason: `Tipo de ficheiro não suportado: ${detectedMime}` };
  }

  return { valid: true };
}

/**
 * Validate file and throw if invalid.
 * Convenience wrapper for use in try/catch.
 */
export function validateFileOrThrow(filePath: string): void {
  const result = validateFile(filePath);
  if (!result.valid) {
    throw new Error(result.reason);
  }
}
