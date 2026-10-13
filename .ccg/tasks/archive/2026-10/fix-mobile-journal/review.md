# Mobile journal review

Scope: only the mobile journal block in app/publication.css. Existing working tree changes were preserved.

## Findings
- No critical findings in local review.
- Root cause confirmed: aspect-ratio 1.1 + min-height 385px expanded the 390px viewport's journal to 423.5px inside a 358px content area.
- Four columns reduced body text to 10px. Mobile now uses two columns and 14px body text.
- Flowing copy and reserved number space handle long Chinese and unbroken English titles without collisions.

## Verification
- Browser assertions: 320, 375, 390, 430, 600, 768, 769, 1000, 1280px: no index overflow or text/number overlap.
- Desktop geometry exactly matches the pre-task stylesheet at 1280px.
- Empty, 1, 2, 3 record states, dark theme and entrance animations checked.
- pnpm test: 17 passed, 0 failed.
- pnpm typecheck: passed.
- Standard pnpm build: blocked by EPERM accessing dist/server/.wrangler. Full five-stage production build PASSED with a temporary config disabling output cleanup only: pnpm build --config .ccg/tasks/fix-mobile-journal/build-verify.config.mjs. Production config unchanged.
- Full working-tree git diff --check reports pre-existing whitespace at publication.css:629, present in publication.before.css. No new whitespace issue in this task diff.

## External review
Both backends were invoked concurrently, including a retry outside the sandbox.
- Antigravity unavailable: agy command not found.
- Claude: APPROVE; no critical findings. Maintainability warning about sizing constants retained for this scoped fix; all dimensions were verified across widths. overflow-wrap:anywhere is intentional for long unbroken titles and passed the real browser test. See review-claude.txt.

## Spec feedback
No existing .ccg/spec was found. No new library/API convention introduced.

