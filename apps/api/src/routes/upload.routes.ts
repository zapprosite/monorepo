import { uploadToDisk } from '@backend/lib/upload';
import type { FastifyInstance } from 'fastify';

export const uploadRouter = (app: FastifyInstance) => {
  // POST /upload/photo — REST endpoint for external integrations
  app.post('/upload/photo', async (request, reply) => {
    const authHeader = request.headers['x-api-key'];
    const teamIdHeader = request.headers['x-team-id'];

    if (!authHeader || !teamIdHeader) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const body = request.body as {
      file: string;
      filename: string;
      mimeType?: string;
    };

    if (!body.file || !body.filename) {
      return reply.status(400).send({ error: 'file and filename required' });
    }

    try {
      const url = await uploadToDisk({
        base64: body.file,
        filename: body.filename,
        teamId: teamIdHeader as string,
        folder: 'photos',
        mimeType: body.mimeType,
      });

      return { url };
    } catch (error) {
      return reply.status(400).send({ error: 'Upload failed' });
    }
  });
};
