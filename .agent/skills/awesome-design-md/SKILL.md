---
name: awesome-design-md
description: "Library of 74 analyzed DESIGN.md files describing the visual design language of well-known products (Apple, Linear, Stripe, Vercel, Notion, Raycast, Tesla, Nike, Spotify, and more). Use when the user asks to build or restyle something in the style of a recognizable product, asks for a DESIGN.md, wants to extract design tokens/rules from a reference product, or needs a concrete art direction instead of generic design advice. Each entry is plain markdown: colors, typography, spacing, motion, components, and rules."
---

# Awesome DESIGN.md

A vendored copy of [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md): one
`DESIGN.md` per product, each reverse-engineered from the real site. Drop a file into a project and any
coding agent reads it as an art direction brief.

## How to use

1. **Pick the reference.** `design-md/` has one directory per product. Read the `README.md` in it for a
   one-line summary, then read that product's `DESIGN.md` in full before writing any UI.
2. **Copy, don't paraphrase.** When a project adopts a direction, put the `DESIGN.md` at the project root
   so it is picked up automatically. Do not summarize it into the codebase; the value is the specifics
   (exact hex values, type scales, radii, shadow stacks).
3. **One direction per surface.** Mixing two `DESIGN.md` files produces mush. If the user asks for
   "Apple but Linear", pick one as the system and cherry-pick single tokens from the other.
4. **Adapt to the product.** These are reference art directions, not copy. Swap brand content, keep the
   system (grids, type scale, motion curve, component anatomy).

## Directly useful for this project

Reprange is a mobile-first workout tracker with a monochrome, high-contrast surface, `--shadow-panel` /
`--shadow-float` elevation, and motion used only as feedback. The entries most likely to be relevant
when extending it:

- `apple-design`-adjacent: `design-md/apple` — restraint, one accent, tight type scale.
- `design-md/raycast` — dense, keyboard-first, monochrome surfaces.
- `design-md/linear.app` — dark product UI, subtle borders over heavy shadows.
- `design-md/stripe` — gradients used sparingly, precise numeric/typographic hierarchy.
- `design-md/spacex` and `design-md/nintendo-2001` — hardware-industrial restraint.

## Contents

74 product directories under `design-md/`, each with `README.md` + `DESIGN.md`. Upstream README is kept at
`README.upstream.md`; license at `LICENSE`.
