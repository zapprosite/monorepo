# CODER-2 Research Report — SPEC-066: frontend-design Audit

## Finding 1: Duplication Analysis

**Status: NOT a duplicate — two versions coexist legitimately**

| Location | Version | Language | Lines | Purpose |
|----------|---------|----------|-------|---------|
| `~/.claude/skills/frontend-design/` | ❌ DOES NOT EXIST | — | — | Global skill not present |
| `/srv/monorepo/.claude/skills/frontend-design/` | v1.0.0 | PT-BR | 51 | Monorepo-specific PT-BR localized |
| `/srv/monorepo/.agent/skills/frontend-design/` | SOTA | EN | 115 | Antigravity Kit authoritative |

**Key insight:** No global duplicate exists. The monorepo version is a **PT-BR localization** of the Antigravity Kit SOTA version.

---

## Finding 2: Content Comparison

### Monorepo Version (PT-BR, 51 lines)
**Focus:** Practical implementation guidance
- Hierarquia visual (1 element per screen)
- Font scale: 12, 14, 16, 20, 24, 32, 48
- Spacing scale: 4px multiples (4, 8, 12, 16, 24, 32, 48, 64)
- Color rules: no pure black (#000→#0F0F0F), no pure white backgrounds
- Stack: React + Tailwind CSS + Framer Motion + Radix UI + Lucide
- Output: mobile-first, componentized, states covered

### Antigravity Kit Version (EN, 115 lines)
**Focus:** UX psychology + design thinking
- Philosophy: "Every pixel has purpose, restraint is luxury"
- REQUIRED reading: `ux-psychology.md`
- UX Laws: Hick's, Fitts', Miller's, Von Restorff, Serial Position
- Anti-patterns: Purple ban, dark+neon default, bento grid for simple pages
- ASK before assuming principle
- Premium indicators checklist

---

## Finding 3: Conflict with Monorepo Stack

Per `/srv/monorepo/AGENTS.md`:
- **Frontend stack:** React 19 + MUI + tRPC (NOT Tailwind)
- **Monorepo skill recommends:** React + Tailwind CSS
- **This is a conflict** — the monorepo frontend-design skill suggests Tailwind, but the project uses MUI

```
# AGENTS.md line 360:
apps/web  →  React 19 + MUI + tRPC

# frontend-design SKILL.md line 42:
Stack recomendada: React + Tailwind CSS
```

---

## Finding 4: April 2026 Best Practices Alignment

The Antigravity Kit `.agent/skills/frontend-design/` aligns better with SOTA:
- **UX Psychology first** — prevents AI "purple everything" syndrome
- **Design thinking over memorizing** — anti-pattern lists
- **Constraint analysis** — timeline, content, brand, tech, audience
- **Ask before assuming** — prevents generic outputs

The monorepo version is more prescriptive ("use Tailwind") which conflicts with project choices.

---

## Recommendations

### KEEP (with update required)
**`/srv/monorepo/.claude/skills/frontend-design/`**

**Rationale:** PT-BR localization serves the Portuguese-speaking team. However, must be updated to:
1. Reference MUI instead of Tailwind (per AGENTS.md stack)
2. Add pointer: "Para SOTA, ver `.agent/skills/frontend-design/`"

### SPEC-066 Classification
- **NOT a duplicate** (no global copy exists)
- **NOT obsolete** — serves PT-BR localization purpose
- **Conflict identified** — Tailwind recommendation vs MUI reality

---

## Specific Change Required

### UPDATE `/srv/monorepo/.claude/skills/frontend-design/SKILL.md`

**Old (line 42):**
```markdown
## Stack recomendada
- React + Tailwind CSS para a maioria dos projetos
```

**New:**
```markdown
## Stack recomendada (monorepo)
- React 19 + MUI + tRPC (ver AGENTS.md stack)
- Para projects fora do monorepo: React + Tailwind + Framer Motion + Radix UI + Lucide

## Fonte Autoritativa
- `.agent/skills/frontend-design/` — SOTA (EN), UX psychology, design thinking
- Esta versão — localization PT-BR + adaptações monorepo
```

---

## What NOT to do

Per SPEC-066 rules (PROIBIDO: minimax, anthropic, token):
- ✅ Safe to update skill content
- ✅ Safe to reference `.agent/` version
- ❌ Do NOT delete without replacing PT-BR guidance
- ❌ Do NOT merge into `.agent/` (they serve different purposes)

---

## Conclusion

| Action | Recommendation |
|--------|----------------|
| Delete monorepo `frontend-design`? | **NO** — PT-BR localization is valuable |
| Update content? | **YES** — fix Tailwind→MUI conflict |
| Reference `.agent/`? | **YES** — establish hierarchy |
| Add to duplicate list? | **NO** — not a duplicate |

**Final verdict:** KEEP + UPDATE to resolve Tailwind/MUI conflict + reference `.agent/` as authoritative source.
