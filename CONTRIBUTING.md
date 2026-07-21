# Contributing to rhetor

## Core principles

1. **No new runtime network calls.** Ever. The only allowed network activity is transformers.js fetching model weights from Hugging Face CDN.
2. **No analytics.** No telemetry, no crash reporting, no pixels, no beacons.
3. **Strict TypeScript.** All code must pass `tsc --noEmit` with strict mode enabled.
4. **Pure analysis functions.** Everything in `src/lib/analysis/` must be pure (no side effects, no DOM, no network). Document inputs, outputs, and thresholds with comments.
5. **SPDX headers.** Every source file must include `// SPDX-License-Identifier: AGPL-3.0-only` as the first line.

## Code style

- Use the existing Tailwind theme (colors, fonts defined in `tailwind.config.js`)
- Components should be under ~250 lines
- Use the `@/` path alias for imports from `src/`
- Prefer inline SVG over icon libraries
- No new dependencies without discussion

## Analysis functions

Functions in `src/lib/analysis/` are the most sensitive code. When modifying:

- Keep them pure — input data in, results out
- Document thresholds and magic numbers with comments explaining why
- Include inline examples in comments showing expected behavior
- Test mentally with edge cases: empty input, single word, very long recordings

## Pull requests

- One feature or fix per PR
- Describe what changed and why
- If modifying analysis logic, explain the impact on scoring
