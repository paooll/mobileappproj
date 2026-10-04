# AGENTS.md

## The rule

**Consult the relevant skills in `.agent/skills/` before you build or change
anything in this app.** Not after, not when stuck — before. Read the skill's
`SKILL.md` first, then follow it.

Sixty-one skills are installed here deliberately. Skipping them and coding
from instinct is how this project ends up with off-brand UI, ad-hoc motion and
inconsistent tokens.

If a task matches no skill, say so rather than pretending one applied.

## Routing

### Interface, visual design, layout

| Task | Skill |
| --- | --- |
| Any design/redesign/polish/audit/typography/color | `impeccable` — the broadest; start here for anything visual |
| Data-driven design decisions, palettes, type pairings, a11y review | `ui-ux-pro-max` |
| Build or restyle in the style of a known product | `awesome-design-md` (74 `DESIGN.md` files) |
| Copy/layout/styling that must not look templated | `taste-skill` |
| Token architecture, component specs | `design-system` |
| Tailwind + shadcn utility and theming work | `ui-styling` |

`ponytail` pushes toward fewer files, fewer dependencies and deletion over
addition. That is a deliberate second opinion, not an override: the house rules
below win. Never let it justify dropping a state cycle, a 44px touch target, an
a11y label, a Firestore rule, or an error path. It already says so itself.

### Motion and interaction

| Task | Skill |
| --- | --- |
| Any animation or transition decision | `design-motion-principles` |
| Auditing existing motion | `review-animations`, `improve-animations`, `find-animation-opportunities` |
| Naming a motion you can't describe | `animation-vocabulary` |
| Native-feeling mobile interaction | `mobile-native`, `apple-design` |

### Engineering discipline

| Task | Skill |
| --- | --- |
| Before any feature or bugfix | `brainstorming`, then `writing-plans` |
| Any bug or unexpected behaviour | `systematic-debugging` |
| Before claiming something works | `verification-before-completion` |
| Reviewing or receiving review | `requesting-code-review`, `receiving-code-review` |
| Engineering process at scale | `ecc` (293 skills, 68 agents — read its SKILL.md first) |
| Simplest solution that works, YAGNI, dependency or abstraction restraint | `ponytail` (`lite` / `full` / `ultra`) |
| Review or audit a diff or repo for over-engineering | `ponytail-review` (diff), `ponytail-audit` (whole repo) |
| List the shortcuts this codebase deliberately deferred | `ponytail-debt` |
| What `ponytail` is and how to switch levels | `ponytail-help`, `ponytail-gain` (impact scoreboard) |

### Ignore these

They target stacks this project does not use: `write-swift`, `animate-expo`,
`slides`, `banner-design`, `brandkit`, `stitch-skill`, `imagegen-*`,
`image-to-code-skill`, `pick-ui-library` (no shadcn here), `ask-sonner` (this
project has its own `Toast`). `claude-mem` and `superpowers` are reference-only
here — see their SKILL.md.

`brag-slim` is vendored from https://github.com/latent-spaces/brag (MIT, at
`cb89b9f`). It makes a short launch video from a project directory or a URL,
and is not part of building or changing the app: reach for it only when
someone asks for a video. The full `/brag` skill is deliberately not vendored,
because its bundled music and example assets would add megabytes of binaries
to a repository that carries none.

## This project

Reprange — mobile-first workout tracker PWA. Vite 8, React 19, TypeScript ~6.0,
Tailwind **v3**, Bun, react-router-dom 7, framer-motion, Firebase 12.

- **Icons:** `@phosphor-icons/react`. Lucide is banned.
- **`erasableSyntaxOnly`** — no TS parameter properties.
- **Design tokens live in `src/index.css`** (`--bg`, `--surface`, `--ink`,
  `--line`, `--shadow-float`, component classes `.glass .panel .btn-solid`).
  Reuse them; do not introduce raw hex values or new one-off utilities.
- **Motion is feedback only**, and must respect the existing
  `prefers-reduced-motion` block.
- **Copy:** no em-dashes. Full state cycles. Never placeholder-as-label.
  44px minimum touch targets, WCAG AA contrast.

### Hard constraint: free plan only

Cloud Storage and Cloud Functions both require a billing-enabled project, so
neither is available. Profile photos live in Firestore at `users/{uid}/avatar`;
the weekly digest runs on GitHub Actions. Do not propose either service.

### Before you call anything done

```
bun tsc -b --noEmit     # must exit 0
bun run lint src        # baseline is 7 warnings, 0 errors
npm run build           # must exit 0
```

`scripts/` sits outside the tsconfig `include` — typecheck and run changed job
scripts separately.

Adding a Firestore path means updating `firestore.rules` and
`FIRESTORE_SCHEMA.md`, or the next deploy will break silently.
