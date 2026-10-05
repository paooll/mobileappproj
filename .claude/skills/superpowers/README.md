# superpowers (plugin wiring)

Vendored from [obra/superpowers](https://github.com/obra/superpowers) v6.4.2 (MIT).

The 15 skills this plugin ships are installed as siblings in `.agent/skills/`, matching the flat layout
used by every other skill in this repo. Cross-skill relative links (`../using-superpowers/references/…`)
still resolve because both directories sit at the same level.

| Installed skill | |
| --- | --- |
| `brainstorming` | turn a vague request into a written design before coding |
| `diagnosing-superpowers` | debug the skill/plugin system itself |
| `dispatching-parallel-agents` | fan work out across subagents |
| `executing-plans` | execute a reviewed plan in phases |
| `finishing-a-development-branch` | merge/cleanup steps at the end of a branch |
| `receiving-code-review` | how to act on review feedback |
| `requesting-code-review` | how to ask for review |
| `subagent-driven-development` | delegate implementation units |
| `systematic-debugging` | reproduce, isolate, fix, verify |
| `test-driven-development` | red/green/refactor discipline |
| `using-git-worktrees` | isolated worktrees |
| `using-superpowers` | entry point, explains the system |
| `verification-before-completion` | prove it works before claiming done |
| `writing-plans` | write plans an agent can execute |
| `writing-skills` | author new skills |

## What is *not* active here

`hooks/`, `index.js`, and `.claude-plugin/` are kept for reference only. `hooks.json` invokes
`${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd`, a variable that only exists when the plugin is installed into a
Claude Code harness. Nothing in this repository loads them, so the SessionStart hook is inert. To get the
hook behaviour, install the upstream plugin into your agent harness rather than relying on this copy.
