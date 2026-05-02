from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_orientation_entrypoints_exist() -> None:
    required_paths = [
        "docs/START-HERE.md",
        ".claude/skills/monorepo-navigator/SKILL.md",
        ".claude/skills/sre-operator/SKILL.md",
        "docs/OPERATIONS/SRE-QUICK-RUNBOOK.md",
    ]

    for relative_path in required_paths:
        assert (ROOT / relative_path).exists(), relative_path


def test_start_here_points_to_canonical_sre_contract() -> None:
    text = (ROOT / "docs/START-HERE.md").read_text(encoding="utf-8")

    assert "scripts/sre-check.sh" in text
    assert "SPEC-SRE-001-estado-da-arte-7d.md" in text
    assert "GitHub Actions" in text
    assert "Gitea" in text


def test_skills_are_flow_oriented_not_everything_dump() -> None:
    navigator = (ROOT / ".claude/skills/monorepo-navigator/SKILL.md").read_text(
        encoding="utf-8"
    )
    sre = (ROOT / ".claude/skills/sre-operator/SKILL.md").read_text(encoding="utf-8")

    assert "Decidir a fonte de verdade" in navigator
    assert "Não usar documentação histórica como verdade" in navigator
    assert "diagnose_only" in sre
    assert "sem aprovação humana" in sre
