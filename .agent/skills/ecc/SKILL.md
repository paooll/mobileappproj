---
name: ecc
description: "Routing entry point for the ECC (Everything Claude Code) bundle from affaan-m/ECC: 293 skills, 68 subagents, 94 slash commands, and 122 rule files covering software-delivery practice — TDD, code review, security review, architecture, Python/TypeScript/Go conventions, git workflows, and agent tooling. Use when a task is about engineering process rather than product design: refactor plans, review passes, debugging discipline, release prep, or writing tests. For pure UI/design work prefer impeccable, taste-skill, or ui-ux-pro-max instead."
---

# ECC

Vendored from [affaan-m/ECC](https://github.com/affaan-m/ECC) v2.2.3 (MIT).

This is a multi-harness bundle, so it is kept nested instead of flattened into `.agent/skills/`. Read the
directory the task calls for rather than loading all of it.

```
skills/     293 skills, one directory each, with its own SKILL.md
agents/     68 subagent definitions (code reviewer, security auditor, …)
commands/   94 slash commands
rules/      122 always-on rule files
```

## Picking one

- Review a change → `skills/code-review`, agent `agents/code-reviewer.md`.
- Harden something before release → `skills/security-review`.
- Plan a refactor → `skills/` entries matching the language or domain you are in.
- Anything about how the UI *looks* → not here. Use `impeccable`, `taste-skill`, `ui-ux-pro-max`,
  `design-motion-principles`, or `awesome-design-md`.

The per-directory `SKILL.md` frontmatter is the index; grep it rather than browsing:

```
grep -l "description:.*review" .agent/skills/ecc/skills/*/SKILL.md
```

## Two deviations from upstream

1. `skills/design-system/` is renamed to `skills/ecc-design-system/` (frontmatter `name:` updated to
   match) because this repo already ships an unrelated `design-system` skill in `.agent/skills/`.
2. `CLAUDE.md` and `.claude-plugin/` are kept for reference. The hooks ECC defines need a harness plugin
   install; nothing here loads them.

Assets, docs (including 6 translated copies), tests, Docker, and the other harness ports (`.cursor`,
`.kiro`, `.codex`, `.opencode`, `pi/`, `ecc2/`) are not vendored.
