// Anti-hardcoded: all config via process.env
// Brand Guardian — brand consistency enforcement for Hermes Agency Suite

import { llmComplete } from '../litellm/router.js';
import { upsertVector, COLLECTIONS } from '../qdrant/client.js';

/**
 * Prohibited terms that indicate brand violations.
 * Loaded from env with fallback defaults.
 */
const PROHIBITED_TERMS = (
  process.env['BRAND_GUARDIAN_PROHIBITED_TERMS'] ?? 'free, cheap,垃圾,spam'
).split(',').map((t) => t.trim().toLowerCase());

/**
 * Competitor names to avoid (env-com-separated).
 */
const BLOCKED_COMPETITORS = (
  process.env['BRAND_GUARDIAN_BLOCKED_COMPETITORS'] ?? ''
).split(',').map((c) => c.trim().toLowerCase());

// ---------------------------------------------------------------------------
// Brand Consistency Check
// ---------------------------------------------------------------------------

/**
 * Uses LLM to score brand consistency 0-1.
 * Analyzes tone, values, and style alignment with brand guidelines.
 */
export async function check_brand_consistency(content: string): Promise<number> {
  const prompt = `Analyze this content for brand consistency (tone, values, style).
Return a number between 0 and 1 where:
- 1 = perfectly on-brand
- 0 = completely off-brand or harmful to brand

Content: "${content}"

Respond with ONLY the number (e.g., 0.85).`;

  try {
    const result = await llmComplete({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 10,
      temperature: 0,
    });
    const score = parseFloat(result.content);
    return Math.max(0, Math.min(1, score));
  } catch {
    return 0.5;
  }
}

// ---------------------------------------------------------------------------
// Violation Scanner
// ---------------------------------------------------------------------------

/**
 * Scans content for prohibited terms and blocked competitors.
 * Returns array of violations found.
 */
export async function scan_for_violations(content: string): Promise<{
  violations: string[];
  prohibitedTerms: string[];
  competitors: string[];
}> {
  const violations: string[] = [];
  const prohibitedTerms: string[] = [];
  const competitors: string[] = [];

  const lowerContent = content.toLowerCase();

  // Check prohibited terms
  for (const term of PROHIBITED_TERMS) {
    if (term && lowerContent.includes(term)) {
      prohibitedTerms.push(term);
      violations.push(`Prohibited term detected: "${term}"`);
    }
  }

  // Check blocked competitors
  for (const competitor of BLOCKED_COMPETITORS) {
    if (competitor && lowerContent.includes(competitor)) {
      competitors.push(competitor);
      violations.push(`Competitor mentioned: "${competitor}"`);
    }
  }

  // LLM secondary scan for contextual violations
  const prompt = `Review this content for brand violations.
Check for:
- Tone inconsistencies (too formal/informal, aggressive, dismissive)
- Off-brand messaging (incompatible with premium positioning)
- Regulatory or ethical concerns

Content: "${content}"

Respond with a JSON object: {"violations": ["list of violation descriptions"]}
If no violations, respond: {"violations": []}`;

  try {
    const result = await llmComplete({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 200,
      temperature: 0,
    });
    const llmViolations = JSON.parse(result.content)?.violations ?? [];
    for (const v of llmViolations) {
      if (!violations.includes(v)) {
        violations.push(v);
      }
    }
  } catch {
    // LLM scan failed, continue with keyword-only results
  }

  return { violations, prohibitedTerms, competitors };
}

// ---------------------------------------------------------------------------
// Approval / Flag Operations
// ---------------------------------------------------------------------------

/**
 * Generates a content hash for Qdrant ID.
 */
function contentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `content_${Math.abs(hash).toString(36)}`;
}

/**
 * Placeholder embedding vector (zeros) — replace with real embedding model
 * when brand guide embeddings are available.
 */
function placeholderVector(): number[] {
  return new Array(1024).fill(0);
}

/**
 * Marks content as approved in Qdrant.
 */
export async function approve_content(content: string): Promise<{
  approved: boolean;
  contentId: string;
}> {
  const contentId = contentHash(content);
  const success = await upsertVector({
    collection: COLLECTIONS.BRAND_GUIDES,
    id: contentId,
    vector: placeholderVector(),
    payload: {
      content,
      status: 'approved',
      approvedAt: new Date().toISOString(),
    },
  });

  return { approved: success, contentId };
}

/**
 * Flags content for human review with a reason.
 */
export async function flag_for_review(content: string, reason: string): Promise<{
  flagged: boolean;
  contentId: string;
  reason: string;
}> {
  const contentId = contentHash(content);
  const success = await upsertVector({
    collection: COLLECTIONS.BRAND_GUIDES,
    id: contentId,
    vector: placeholderVector(),
    payload: {
      content,
      status: 'flagged',
      reason,
      flaggedAt: new Date().toISOString(),
    },
  });

  return { flagged: success, contentId, reason };
}

// ---------------------------------------------------------------------------
// Content Quality Score
// ---------------------------------------------------------------------------

/**
 * Overall quality score 0-1 combining brand consistency and violation scan.
 * Used by agency_router before routing to creative/social/design skills.
 */
export async function score_content(content: string): Promise<number> {
  const [consistency, violationsResult] = await Promise.all([
    check_brand_consistency(content),
    scan_for_violations(content),
  ]);

  // Deduct for each violation (max 50% penalty)
  const violationPenalty = Math.min(0.5, violationsResult.violations.length * 0.1);

  // Combine: 70% brand consistency + 30% violation-free bonus
  const violationBonus = violationsResult.violations.length === 0 ? 0.1 : 0;
  const score = Math.max(0, Math.min(1, consistency * 0.9 - violationPenalty + violationBonus));

  return score;
}
