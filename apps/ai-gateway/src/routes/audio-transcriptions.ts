/**
 * SPEC-048 — POST /v1/audio/transcriptions
 * STT pipeline (cópia exacta da lógica do voice.sh / F12):
 *   1. Receber áudio (multipart, ogg/mp3/wav)
 *   2. ffmpeg → WAV 16kHz mono
 *   3. wav2vec2 :8202 → transcrição raw PT-BR
 *   4. applyPtbrFilter (mode='stt') → correcção PT-BR via tom-cat-8b
 *
 * Anti-hardcoded: STT_DIRECT_URL via process.env
 */

import type { FastifyInstance } from 'fastify';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { applyPtbrFilter } from '../middleware/ptbr-filter.js';

const execFileAsync = promisify(execFile);
const STT_URL = process.env['STT_DIRECT_URL'] ?? 'http://localhost:8202';

// ── Multipart extractor ────────────────────────────────────────────────────

interface ParsedMultipart {
  fileBytes: Buffer;
  fileExt: string;
  responseFormat: string;
}

function parseMultipart(body: Buffer, contentType: string): ParsedMultipart {
  const bm = contentType.match(/boundary=["']?([^\s"';]+)["']?/);
  if (!bm) return { fileBytes: body, fileExt: 'ogg', responseFormat: 'json' };

  const boundary = `--${bm[1]}`;
  const sep = '\r\n' + boundary;
  const bodyStr = body.toString('binary');
  const parts = bodyStr.split(sep);

  let fileBytes: Buffer | null = null;
  let fileExt = 'ogg';
  let responseFormat = 'json';

  for (const part of parts) {
    const sepIdx = part.indexOf('\r\n\r\n');
    if (sepIdx === -1) continue;
    const headers = part.slice(0, sepIdx);
    const dataStr = part.slice(sepIdx + 4).replace(/\r\n$/, '');

    if (headers.includes('name="response_format"')) {
      responseFormat = dataStr.trim();
      continue;
    }
    if (headers.includes('name="file"') || headers.match(/content-type:\s*audio\//i)) {
      const ctMatch = headers.match(/content-type:\s*audio\/([^\r\n;]+)/i);
      fileExt = (ctMatch ? (ctMatch[1] ?? 'ogg').trim().replace('mpeg', 'mp3') : 'ogg')
        .replace('ogg-opus', 'ogg')
        .replace('opus', 'ogg');
      fileBytes = Buffer.from(dataStr, 'binary');
    }
  }

  return { fileBytes: fileBytes ?? body, fileExt, responseFormat };
}

// ── ffmpeg OGG/MP3/M4A → WAV 16kHz mono ───────────────────────────────────

async function toWav16k(audioBytes: Buffer, ext: string): Promise<Buffer> {
  const id = randomBytes(6).toString('hex');
  const tmpIn = path.join(os.tmpdir(), `gw-stt-in-${id}.${ext}`);
  const tmpOut = path.join(os.tmpdir(), `gw-stt-out-${id}.wav`);
  try {
    fs.writeFileSync(tmpIn, audioBytes);
    await execFileAsync('ffmpeg', ['-y', '-i', tmpIn, '-ar', '16000', '-ac', '1', tmpOut], {
      timeout: 30000,
    });
    return fs.readFileSync(tmpOut);
  } finally {
    try {
      fs.unlinkSync(tmpIn);
    } catch {
      /* ignore */
    }
    try {
      fs.unlinkSync(tmpOut);
    } catch {
      /* ignore */
    }
  }
}

// ── Send WAV to wav2vec2 ───────────────────────────────────────────────────

function transcribeWav(wavBytes: Buffer): Promise<string> {
  const boundary = `----boundary${randomBytes(8).toString('hex')}`;
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`,
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const reqBody = Buffer.concat([header, wavBytes, footer]);
  const url = new URL(`${STT_URL}/v1/audio/transcriptions`);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: Number(url.port) || 80,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': reqBody.length,
        },
        timeout: 60000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')).text ?? '');
          } catch (e) {
            reject(new Error(`wav2vec2 parse: ${e}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('wav2vec2 timeout'));
    });
    req.write(reqBody);
    req.end();
  });
}

// ── Route ──────────────────────────────────────────────────────────────────

export async function audioTranscriptionsRoute(app: FastifyInstance) {
  app.post('/audio/transcriptions', async (request, reply) => {
    try {
      const body = request.body as Buffer | undefined;
      const contentType = request.headers['content-type'] ?? '';

      if (!body || !Buffer.isBuffer(body) || body.length === 0) {
        return reply
          .code(400)
          .send({ error: { message: 'No audio file provided', type: 'invalid_request_error' } });
      }

      const { fileBytes, fileExt, responseFormat } = parseMultipart(body, contentType);

      if (!fileBytes || fileBytes.length === 0) {
        return reply.code(400).send({
          error: { message: 'No file field in multipart body', type: 'invalid_request_error' },
        });
      }

      const wavBytes = await toWav16k(fileBytes, fileExt);
      const rawText = await transcribeWav(wavBytes);
      const text = await applyPtbrFilter(rawText, undefined, 'stt');

      if (responseFormat === 'text') return reply.type('text/plain').send(text);
      return reply.send({ text });
    } catch (err: unknown) {
      const msg = (err as Error).message ?? 'STT error';
      process.stderr.write(`[stt] error: ${msg}\n`);
      return reply.code(502).send({ error: { message: msg, type: 'upstream_error' } });
    }
  });
}
