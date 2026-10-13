# Mobile editorial title verification

Self-reviewed directly, without external models or subagents as requested.

## Changes
- Cover title size: clamp(50px,16vw,80px); desktop line-height .90 and stepped .60/1.20em indentation retained on mobile.
- Cover italic caption follows the desktop 1.20em offset, with proportionate spacing.
- Phone contact headline: clamp(34px,10.5vw,60px), line-height .84 and desktop .34/.30/0/.74em offsets.
- Restored an 18px central ring and three-column composition with vertically centered contact actions.
- Right-aligned smaller italic invitation; explicit scoped mobile font size avoids the later global caption override.
- Tablet contact headline size transitions smoothly at 600/601px (60px/60.1px), contacts stay centered.
- Only responsive declarations in publication.css changed.

## Checks
- 13 widths: 320,360,375,390,430,600,601,768,769,900,901,1024,1440px; no horizontal page or title-column overflow.
- Desktop geometry at 1440px exactly matches the pre-task stylesheet.
- Light/dark screenshots inspected; normal entrance animations finish visibly; reduced motion supported.
- Mailto target and four social links/buttons retained.
- pnpm test: 17 passed, 0 failed; pnpm typecheck passed; git diff --check passed.
- Full production build passed using the temporary verification config that disables output cleanup around the existing Windows .wrangler directory lock. Production config unchanged.

No new library/API convention added. Desktop and other sections remain unchanged. Changes are local and not pushed.
