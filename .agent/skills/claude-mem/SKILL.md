---
name: claude-mem
description: "Routing entry point for the skill layer of claude-mem (thedotmack/claude-mem v13.29.0): 22 skills covering cross-session memory, search over past work, session handoff and standup, codebase learning, planning, cost reporting, and workflow modes. Use when a task is about recalling or carrying context across sessions rather than writing code. Note that the memory server itself is NOT vendored here — see the runtime note below before relying on any mem-* skill."
---

# claude-mem (skill layer only)

Vendored from [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) v13.29.0 (Apache-2.0).

## Runtime note, read first

claude-mem is not a document-based skill pack. It is an MCP server: it hooks the transcript, compresses it
into a SQLite knowledge graph, and serves search back to the agent. The skills here call that server.

Only the skill layer is vendored. The runtime — `plugin/scripts/` (12 MB), the UI bundle, the SQLite
bindings, the workers, and the transcript hooks — is not, because it is an installed service, not project
content.

**Consequence:** `skills/mem-search`, `skills/how-it-works`, `skills/handoff`, `skills/standup`, and
anything else that queries memory will fail without a running claude-mem server. Treat them as
documentation until you install the plugin into your agent harness. Skills that do not touch the server
still work as written.

To get the real thing, install the upstream plugin into your harness rather than using this copy; this
directory is a reference copy only.

## What is here

```
skills/  22 skills, one directory each
modes/   36 workflow mode presets
hooks/   hook config, inert without a harness plugin install
```

Server-independent skills (`make-plan`, `learn-codebase`, `design-is`, `smart-explore`, `agent-cost-report`)
are usable today. `agent-cost-report` ships a standalone Python cost analyser under `scripts/`.
