import { z } from 'zod';

export const uploadPhotoZod = z.object({
  file: z.string(),
  filename: z.string(),
  mimeType: z.string().optional(),
  equipmentId: z.string().uuid().optional(),
  scheduleId: z.string().uuid().optional(),
});

export const uploadSignatureZod = z.object({
  file: z.string(),
  filename: z.string().default('signature.png'),
  type: z.enum(['technician', 'client']),
});

export type UploadPhotoInput = z.infer<typeof uploadPhotoZod>;
export type UploadSignatureInput = z.infer<typeof uploadSignatureZod>;