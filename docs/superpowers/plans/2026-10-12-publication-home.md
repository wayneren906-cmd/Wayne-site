# Wayneo publication homepage

Approved direction: independent publication, Swiss typography and restrained experiments. Warm paper, monochrome photography, natural light, intentional crops. Keep existing photos as labelled layout references; do not invent locations, equipment or completed projects. Preserve existing journal and project routes.

- [x] Replace homepage with cover, live journal index, project preview and photographic essay. Empty API responses remain empty; failed refreshes retain previously fetched real records.
- [x] Add scoped publication styles: staggered typography, oversized index numbers, asymmetric photo layout, responsive reading, reduced-motion support.
- [x] Share footer, remove invented typography credits and use actual repository link.
- [x] Verified existing journal date parameter handling, type checking, 17 existing tests and production build. Inspected desktop and 390px mobile preview, empty local archive, photo loading, theme toggle and journal navigation. Restored omitted journal styles in a scope limited to its shell.

Build validation: `pnpm build --emptyOutDir false` succeeds. Default output cleanup encounters an EPERM on existing `dist/server/.wrangler`; preserving that local runtime directory avoids deleting its state. Existing Vite dynamic-import warnings remain. Populated records and refresh failure were not browser-tested because the local archive is empty.

Files: app/personal-home.tsx, app/publication.css, app/layout.tsx, app/site-footer.tsx, app/journal.tsx. Keep current checkout to preserve user's in-progress assets. No deployment or Git commit in this pass.
