/**
 * SPEC-048 — POST /v1/audio/transcriptions
 * STT pipeline via Groq cloud (whisper-large-v3) — fast, no local GPU/ffmpeg needed.
 *
 * Mínimo viável voice gateway:
 *   • ai-gateway :4002 = voice facade (TTS + STT)
 *   • TTS backend = edge-tts :8012 (Microsoft Edge Neural PT-BR)
 *   • STT backend = Groq cloud whisper-large-v3 (OpenAI-compatible)
 *
 * Groq accepts: mp3, mp4, mpeg, mpga, m4a, wav, webm — no ffmpeg conversion required.
 * Anti-hardcoded: GROQ_API_KEY via process.env
 */

import { randomBytes } from 'node:crypto';
import * as https from 'node:https';
import type { FastifyInstance } from 'fastify';
import { applyPtbrFilter } from '../middleware/ptbr-filter.js';

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? '';
if (!GROQ_API_KEY) {
	console.error('[SECURITY] GROQ_API_KEY not set — STT will fail');
}

// ── Multipart extractor ────────────────────────────────────────────────────

interface ParsedMultipart {
	fileBytes: Buffer;
	fileExt: string;
	responseFormat: string;
}

function parseMultipart(body: Buffer, contentType: string): ParsedMultipart {
	const bm = contentType.match(/boundary=["']?([^\s"';]+)["']?/);
	if (!bm) return { fileBytes: body, fileExt: 'mp3', responseFormat: 'json' };

	const boundary = `--${bm[1]}`;
	const sep = `\r\n${boundary}`;
	const bodyStr = body.toString('binary');
	const parts = bodyStr.split(sep);

	let fileBytes: Buffer | null = null;
	let fileExt = 'mp3';
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
			fileExt = (ctMatch ? (ctMatch[1] ?? 'mp3').trim().replace('mpeg', 'mp3') : 'mp3')
				.replace('ogg-opus', 'ogg')
				.replace('opus', 'ogg');
			fileBytes = Buffer.from(dataStr, 'binary');
		}
	}

	return { fileBytes: fileBytes ?? body, fileExt, responseFormat };
}

// ── Send audio to Groq STT (OpenAI-compatible) ─────────────────────────────

function transcribeWithGroq(audioBytes: Buffer, ext: string): Promise<string> {
	const boundary = `----boundary${randomBytes(8).toString('hex')}`;
	const header = Buffer.from(
		`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: audio/${ext}\r\n\r\n`,
	);
	const modelField = Buffer.from(
		`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3\r\n`,
	);
	const languageField = Buffer.from(
		`\r\n--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\npt\r\n`,
	);
	const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
	const reqBody = Buffer.concat([header, audioBytes, modelField, languageField, footer]);

	return new Promise((resolve, reject) => {
		const req = https.request(
			{
				hostname: 'api.groq.com',
				port: 443,
				path: '/openai/v1/audio/transcriptions',
				method: 'POST',
				headers: {
					Authorization: `Bearer ${GROQ_API_KEY}`,
					'Content-Type': `multipart/form-data; boundary=${boundary}`,
					'Content-Length': reqBody.length,
				},
				timeout: 30000,
			},
			(res) => {
				const chunks: Buffer[] = [];
				res.on('data', (c: Buffer) => chunks.push(c));
				res.on('end', () => {
					try {
						const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
						resolve(data.text ?? '');
					} catch (e) {
						reject(new Error(`Groq STT parse: ${e}`));
					}
				});
			},
		);
		req.on('error', reject);
		req.on('timeout', () => {
			req.destroy();
			reject(new Error('Groq STT timeout'));
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

			const rawText = await transcribeWithGroq(fileBytes, fileExt);
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
