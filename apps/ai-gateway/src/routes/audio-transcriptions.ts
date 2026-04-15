/**
 * SPEC-048 — POST /v1/audio/transcriptions
 * STT: wav2vec2-large-xlsr-53-portuguese :8202 (nativo PT-BR, 82%+ accuracy)
 *
 * Pipeline: multipart/form-data → extract audio → ffmpeg → WAV 16kHz → wav2vec2
 * Suporta: ogg (Telegram), mp3, wav, m4a — qualquer formato que ffmpeg aceite
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

const execFileAsync = promisify(execFile);
const STT_URL = process.env.STT_DIRECT_URL ?? 'http://localhost:8202';

// ── Multipart parser ────────────────────────────────────────────────────────

interface MultipartFields {
  fileBytes: Buffer;
  fileExt: string;
  responseFormat: string;
}

function parseMultipart(body: Buffer, contentType: string): MultipartFields {
  const bm = contentType.match(/boundary=["']?([^\s"';]+)["']?/);
  if (!bm) return { fileBytes: body, fileExt: 'ogg', responseFormat: 'json' };

  const boundary = `--${bm[1]}`;
  const parts = body.toString('binary').split(boundary);

  let fileBytes: Buffer | null = null;
  let fileExt = 'ogg';
  let responseFormat = 'json';

  for (const part of parts) {
    if (!part.includes('Content-Disposition')) continue;
    const sepIdx = part.indexOf('\r\n\r\n');
    if (sepIdx === -1) continue;

    const headers = part.slice(0, sepIdx);
    const dataStr = part.slice(sepIdx + 4).replace(/\r\n$/, '');

    // response_format field
    if (headers.includes('name="response_format"')) {
      responseFormat = dataStr.trim();
      continue;
    }

    // file field — detect by name="file" or audio content-type
    if (headers.includes('name="file"') || headers.match(/content-type:\s*audio\//i)) {
      const ctMatch = headers.match(/content-type:\s*audio\/([^\r\n;]+)/i);
      fileExt = ctMatch
        ? ctMatch[1].trim().replace('mpeg', 'mp3').replace('ogg-opus', 'ogg')
        : 'ogg';
      // Re-extract as Buffer (binary-safe)
      const partBuf = Buffer.from(part, 'binary');
      const headersBuf = Buffer.from(headers + '\r\n\r\n', 'binary');
      const start = partBuf.indexOf(headersBuf) + headersBuf.length;
      let end = partBuf.length;
      if (partBuf.slice(-2).toString() === '\r\n') end -= 2;
      fileBytes = partBuf.slice(start, end);
    }
  }

  return {
    fileBytes: fileBytes ?? body,
    fileExt,
    responseFormat,
  };
}

// ── ffmpeg convert to WAV 16kHz mono ───────────────────────────────────────

async function toWav16k(audioBytes: Buffer, ext: string): Promise<Buffer> {
  const id = randomBytes(6).toString('hex');
  const tmpIn = path.join(os.tmpdir(), `gw-stt-${id}.${ext}`);
  const tmpOut = path.join(os.tmpdir(), `gw-stt-${id}.wav`);
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

// ── Send WAV to wav2vec2 ────────────────────────────────────────────────────

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
            const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            resolve(typeof json.text === 'string' ? json.text : '');
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

// ── Route ───────────────────────────────────────────────────────────────────

export async function audioTranscriptionsRoute(app: FastifyInstance) {
  app.post('/audio/transcriptions', async (request, reply) => {
    try {
      const body = request.body as Buffer;
      const contentType = request.headers['content-type'] ?? '';

      const { fileBytes, fileExt, responseFormat } = parseMultipart(body, contentType);
      const wavBytes = await toWav16k(fileBytes, fileExt);
      const text = await transcribeWav(wavBytes);

      // OpenAI SDK sends response_format=text → expects plain text response
      if (responseFormat === 'text') {
        return reply.type('text/plain').send(text);
      }
      return reply.send({ text });
    } catch (err: unknown) {
      const msg = (err as Error).message ?? 'STT error';
      process.stderr.write(`[stt] error: ${msg}\n`);
      return reply.code(502).send({ error: { message: msg, type: 'upstream_error' } });
    }
  });
}
