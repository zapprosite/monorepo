/**
 * SPEC-048 — POST /v1/audio/transcriptions
 * STT: wav2vec2-large-xlsr-53-portuguese :8202 (nativo PT-BR, 82%+ accuracy)
 * Converte qualquer formato → WAV 16kHz mono via ffmpeg, depois envia para wav2vec2
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

/** Convert any audio buffer → WAV 16kHz mono via ffmpeg */
async function toWav16k(audioBytes: Buffer, ext = 'ogg'): Promise<Buffer> {
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

/** POST WAV to wav2vec2 as multipart/form-data → returns transcript text */
function transcribeWav(wavBytes: Buffer): Promise<string> {
  const boundary = `----boundary${randomBytes(8).toString('hex')}`;
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\n` +
      `Content-Type: audio/wav\r\n\r\n`,
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, wavBytes, footer]);
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
          'Content-Length': body.length,
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
            reject(new Error(`wav2vec2 parse error: ${e}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('wav2vec2 timeout'));
    });
    req.write(body);
    req.end();
  });
}

/** Extract raw audio bytes from multipart body using boundary */
function extractAudioFromMultipart(
  body: Buffer,
  contentType: string,
): { bytes: Buffer; ext: string; responseFormat: string } {
  const bm = contentType.match(/boundary=["']?([^"';\s]+)["']?/);
  if (!bm) return { bytes: body, ext: 'bin' };

  const sep = Buffer.from(`--${bm[1]}`);
  let start = body.indexOf(sep);
  while (start !== -1) {
    const partStart = start + sep.length + 2; // skip \r\n
    const nextSep = body.indexOf(sep, partStart);
    const part = nextSep === -1 ? body.slice(partStart) : body.slice(partStart, nextSep - 2);

    const headerEnd = indexOf(part, Buffer.from('\r\n\r\n'));
    if (headerEnd !== -1) {
      const headers = part.slice(0, headerEnd).toString();
      if (
        headers.toLowerCase().includes('content-disposition') &&
        headers.toLowerCase().includes('name="file"')
      ) {
        const data = part.slice(headerEnd + 4);
        // Detect ext from Content-Type header
        const ctMatch = headers.match(/content-type:\s*audio\/([^\r\n;]+)/i);
        const ext = ctMatch ? ctMatch[1].replace('mpeg', 'mp3') : 'ogg';
        return { bytes: data, ext, responseFormat: extractField(body, sep, 'response_format') };
      }
    }
    start = nextSep === -1 ? -1 : body.indexOf(sep, nextSep + sep.length);
  }
  // Search first 2KB (text headers before binary audio) for response_format
  const head2k = body.slice(0, 2048).toString('utf8', 0, 2048);
  const rfMatch = head2k.match(/name="response_format"\r\n\r\n([\w-]+)/);
  const responseFormat = rfMatch ? rfMatch[1].trim() : 'json';
  return { bytes: body, ext: 'ogg', responseFormat };
}

function indexOf(buf: Buffer, search: Buffer): number {
  for (let i = 0; i <= buf.length - search.length; i++) {
    let match = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i + j] !== search[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

/** Extract a named text field value from multipart body */
function extractField(body: Buffer, sep: Buffer, fieldName: string): string {
  let start = body.indexOf(sep);
  while (start !== -1) {
    const partStart = start + sep.length + 2;
    const nextSep = body.indexOf(sep, partStart);
    const part = nextSep === -1 ? body.slice(partStart) : body.slice(partStart, nextSep - 2);
    const headerEnd = indexOf(part, Buffer.from('\r\n\r\n'));
    if (headerEnd !== -1) {
      const headers = part.slice(0, headerEnd).toString();
      if (headers.includes(`name="${fieldName}"`)) {
        return part
          .slice(headerEnd + 4)
          .toString('utf8')
          .trim();
      }
    }
    start = nextSep === -1 ? -1 : body.indexOf(sep, nextSep + sep.length);
  }
  return 'json';
}

export async function audioTranscriptionsRoute(app: FastifyInstance) {
  app.post('/audio/transcriptions', async (request, reply) => {
    try {
      const body = request.body as Buffer;
      const contentType = request.headers['content-type'] ?? '';

      const {
        bytes: audioBytes,
        ext,
        responseFormat,
      } = extractAudioFromMultipart(body, contentType);
      const wavBytes = await toWav16k(audioBytes, ext);
      const text = await transcribeWav(wavBytes);

      // OpenAI SDK sends response_format=text → expect plain string response
      if (responseFormat === 'text') return reply.type('text/plain').send(text);
      return reply.send({ text });
    } catch (err: unknown) {
      const msg = (err as Error).message ?? 'STT error';
      process.stderr.write(`[stt] error: ${msg}\n`);
      return reply.code(502).send({ error: { message: msg, type: 'upstream_error' } });
    }
  });
}
