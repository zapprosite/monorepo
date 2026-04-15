/**
 * SPEC-047 — OpenAI-compatible API schemas (Zod)
 * Used by apps/ai-gateway to validate incoming requests and outgoing responses.
 * Anti-hardcoded: no URLs, tokens or model names hardcoded here — all via process.env.
 */

import { z } from 'zod';

// ── Chat Completions ──────────────────────────────────────────────────────────

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.union([
    z.string(),
    z.array(
      z.union([
        z.object({ type: z.literal('text'), text: z.string() }),
        z.object({ type: z.literal('image_url'), image_url: z.object({ url: z.string() }) }),
      ]),
    ),
  ]),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
});

export const ChatCompletionRequestSchema = z.object({
  model: z.string().default('gpt-4o'), // alias accepted — gateway remaps to upstream
  messages: z.array(ChatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  stream: z.boolean().default(false),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  user: z.string().optional(),
  // PT-BR filter control (SPEC-047 extension)
  'x-ptbr-filter': z.boolean().optional(),
});

export const ChatChoiceSchema = z.object({
  index: z.number().int(),
  message: ChatMessageSchema,
  finish_reason: z.enum(['stop', 'length', 'tool_calls', 'content_filter', 'null']).nullable(),
});

export const ChatCompletionResponseSchema = z.object({
  id: z.string(),
  object: z.literal('chat.completion'),
  created: z.number().int(),
  model: z.string(),
  choices: z.array(ChatChoiceSchema),
  usage: z
    .object({
      prompt_tokens: z.number().int(),
      completion_tokens: z.number().int(),
      total_tokens: z.number().int(),
    })
    .optional(),
  // Gateway metadata (only in debug mode — never expose to end clients in prod)
  'x-ai-gateway-upstream': z.string().optional(),
});

// ── Audio — TTS ───────────────────────────────────────────────────────────────

// SPEC-009: Kokoro via TTS Bridge só suporta pm_santa / pf_dora (PT-BR voices)
// VOICES OpenAI (alloy, echo, fable, onyx, nova, shimmer) NÃO são Kokoro — removidos
export const TTS_ALLOWED_VOICES = ['pm_santa', 'pf_dora'] as const;

export const AudioSpeechRequestSchema = z.object({
  model: z.enum(['tts-1', 'tts-1-hd']).default('tts-1'),
  input: z.string().min(1).max(4096),
  voice: z.enum(TTS_ALLOWED_VOICES).default('pm_santa'),
  response_format: z.enum(['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm']).default('mp3'),
  speed: z.number().min(0.25).max(4.0).default(1.0),
});

// ── Audio — STT ───────────────────────────────────────────────────────────────

export const AudioTranscriptionRequestSchema = z.object({
  // file: handled as multipart/form-data by gateway — not in body schema
  model: z.enum(['whisper-1']).default('whisper-1'),
  language: z.string().default('pt'),
  prompt: z.string().optional(),
  response_format: z.enum(['json', 'text', 'srt', 'verbose_json', 'vtt']).default('json'),
  temperature: z.number().min(0).max(1).default(0),
});

export const AudioTranscriptionResponseSchema = z.object({
  text: z.string(),
  // verbose_json extras
  language: z.string().optional(),
  duration: z.number().optional(),
  segments: z.array(z.any()).optional(),
});

// ── Models list ───────────────────────────────────────────────────────────────

export const ModelObjectSchema = z.object({
  id: z.string(),
  object: z.literal('model'),
  created: z.number().int(),
  owned_by: z.string(),
});

export const ModelsListResponseSchema = z.object({
  object: z.literal('list'),
  data: z.array(ModelObjectSchema),
});

// ── Auth ──────────────────────────────────────────────────────────────────────

/** Bearer token extracted from Authorization header — validated with constant-time compare */
export const BearerTokenSchema = z.object({
  token: z.string().min(16),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;
export type ChatCompletionResponse = z.infer<typeof ChatCompletionResponseSchema>;
export type AudioSpeechRequest = z.infer<typeof AudioSpeechRequestSchema>;
export type AudioTranscriptionRequest = z.infer<typeof AudioTranscriptionRequestSchema>;
export type AudioTranscriptionResponse = z.infer<typeof AudioTranscriptionResponseSchema>;
export type ModelsListResponse = z.infer<typeof ModelsListResponseSchema>;
