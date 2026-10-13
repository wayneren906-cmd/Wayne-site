# Editorial system refinement implementation plan

> Execution: inline, directly reviewed by Codex; no dual-model review per user instruction.

Goal: apply the approved first round of typography, spacing and inner-page consistency without replacing the homepage's cover/contact composition or changing data/auth behavior.

Architecture: shared CSS tokens in globals.css; existing publication and journal styles consume them. Projects use semantic numbered articles and a quiet status note instead of boxed cards. Four source files only: app/globals.css, app/publication.css, app/journal-reading.css, app/projects/page.tsx.

- [x] Capture browser baselines and failing cross-page gutter/nav/footer consistency checks.
- [x] Define shared 1440px page width, 48/32/20px gutters, 16/15px body, 12/11px caption, section spacing and footer/nav typography. Keep safe-area insets.
- [x] Replace project inline styles/cards with scoped works classes, numbered articles and ruled sections; retain all existing project descriptions/tags/status/link and accessible heading structure.
- [x] Apply shared spacing/caption tokens to homepage while preserving title and contact geometry; increase mobile body text and metadata readability.
- [x] Align journal page container and chrome; set 16/15px note body, 17/16px labels, relaxed reading rhythm and limited text measure. Keep long-label wrapping, search/date/history/edit behavior unchanged.
- [x] Browser verify all routes at 320,390,768,1024,1440px, light/dark, long labels, search/month filters, heatmap scroll, links and heading structure. Compare homepage hero/contact positions/fonts before/after where unaffected by shared gutters.
- [x] Run pnpm test, pnpm typecheck, full production build, git diff --check. Self-review scope and responsive cascade. Archive the task after completion; no GitHub push unless requested.

