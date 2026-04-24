// Anti-hardcoded: all config via process.env
import { describe, it, expect } from 'vitest';
import { AGENCY_SKILLS, getSkillById, getSkillByTrigger } from '../skills/index.js';

describe('AGENCY_SKILLS registry', () => {
  it('has 12 skills defined', () => {
    expect(AGENCY_SKILLS.length).toBe(12);
  });

  it('all skills have unique IDs', () => {
    const ids = AGENCY_SKILLS.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all skills have non-empty tools array', () => {
    for (const skill of AGENCY_SKILLS) {
      expect(skill.tools.length).toBeGreaterThan(0);
    }
  });

  it('all skills have at least one trigger', () => {
    for (const skill of AGENCY_SKILLS) {
      expect(skill.triggers.length).toBeGreaterThan(0);
    }
  });

  it('all triggers across skills are globally unique (HC-33)', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const skill of AGENCY_SKILLS) {
      for (const t of skill.triggers) {
        const key = t.toLowerCase();
        if (seen.has(key)) duplicates.push(`'${key}' in ${skill.id}`);
        seen.add(key);
      }
    }
    expect(duplicates).toEqual([]);
  });
});

describe('getSkillById', () => {
  it('returns skill for known ID', () => {
    const skill = getSkillById('agency-ceo');
    expect(skill).toBeDefined();
    expect(skill?.name).toBe('CEO MIX');
  });

  it('returns undefined for unknown ID', () => {
    expect(getSkillById('agency-does-not-exist')).toBeUndefined();
  });

  it('returns correct skill for every defined ID', () => {
    for (const s of AGENCY_SKILLS) {
      const found = getSkillById(s.id);
      expect(found?.id).toBe(s.id);
    }
  });
});

describe('getSkillByTrigger', () => {
  it('returns skill for exact trigger match', () => {
    const skill = getSkillByTrigger('/start');
    expect(skill?.id).toBe('agency-ceo');
  });

  it('lookup is case-insensitive', () => {
    const lower = getSkillByTrigger('/start');
    const upper = getSkillByTrigger('/START');
    expect(lower?.id).toBe(upper?.id);
  });

  it('returns skill for "vídeo" trigger', () => {
    const skill = getSkillByTrigger('vídeo');
    expect(skill?.id).toBe('agency-video-editor');
  });

  it('returns undefined for unknown trigger', () => {
    expect(getSkillByTrigger('__totally-unknown-trigger-xyz__')).toBeUndefined();
  });
});
