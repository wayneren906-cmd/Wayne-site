# Editorial system self-review

## Scope
Four source files: globals.css, publication.css, journal-reading.css, projects/page.tsx. User approved typography, spacing and inner-page consistency, and explicitly disabled dual-model review. Direct review only; no external models or subagents.

## Delivered
- Shared 1440px container and safe-area-aware 48/32/20px gutters; common navigation, footer branding and captions.
- Shared 16px desktop / 15px mobile body and 12/11px captions, consistent page/section spacing.
- Preserved homepage cover/contact lettering, photos and animations; increased small mobile reading text.
- Journal prose has relaxed 1.95 line-height, 68ch maximum width and wrapping labels; search/calendar/history/edit logic unchanged.
- Projects became semantic numbered article rows with h2 titles and list-based technology labels. Existing descriptions, planned-project status and journal link preserved.
- Introduction and catalog body axes match within 1px at 769/1024/1440px. Footer/grid cascade directly checked.

## Verification
- Original cross-page mobile gutter assertion failed (16px/20px/16px); after changes, all pages match.
- 27 layout cases: 3 routes at 320,390,600,700,768,769,900,1024,1440px. No clipping/overflow; gutter, navigation font, footer size and footer caption size match across routes.
- Search empty/reset, month filtering, date filtering, contained heatmap scrolling, long labels and Works -> Journal link passed.
- Light/dark screenshots visually inspected after theme transitions. One h1, three article h2 titles, 12 technology labels retained.
- pnpm test: 17 pass, 0 fail; pnpm typecheck pass; git diff --check pass.
- Full production compilation passed with a temporary verification config disabling output cleanup around the existing Windows .wrangler directory lock. Production Vite config unchanged. Existing dynamic-import warnings only.

No critical or warning findings remain. Changes are local, not pushed. Shared editorial token and screenshot conventions documented in .ccg/spec/frontend/index.md.
