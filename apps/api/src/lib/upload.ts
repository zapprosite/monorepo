import { db } from '@backend/db/db';
import { TRPCError } from '@trpc/server';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';

export interface UploadOptions {
  base64: string;
  filename: string;
  teamId: string;
  folder: 'photos' | 'signatures' | 'reports';
  mimeType?: string;
}

export async function uploadToDisk(options: UploadOptions): Promise<string> {
  const { base64, filename, teamId, folder, mimeType } = options;

  // Validate MIME type
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (mimeType && !allowedMimeTypes.includes(mimeType)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tipo de arquivo não permitido' });
  }

  // Validate file size (max 5MB)
  const sizeInBytes = (base64.length * 3) / 4;
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (sizeInBytes > maxSize) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Arquivo muito grande (max 5MB)' });
  }

  // Create directory structure
  const date = new Date().toISOString().split('T')[0];
  const uploadPath = join(UPLOAD_DIR, teamId, date, folder);
  if (!existsSync(uploadPath)) {
    mkdirSync(uploadPath, { recursive: true });
  }

  // Generate unique filename
  const ext = filename.split('.').pop() || 'jpg';
  const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
  const filePath = join(uploadPath, uniqueName);

  // Write file
  const buffer = Buffer.from(base64, 'base64');
  writeFileSync(filePath, buffer);

  // Return public URL
  return `/uploads/${teamId}/${date}/${folder}/${uniqueName}`;
}
