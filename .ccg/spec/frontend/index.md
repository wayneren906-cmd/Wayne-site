# Frontend editorial conventions

- Use the shared --editorial-* tokens in app/globals.css for page width, safe-area gutters, body/caption/navigation sizes and section spacing. Home, journal and works must align at the same viewport; avoid local fixed nav/footer sizes that override these tokens.
- Keep display lettering limited to established cover/contact compositions. Reading content uses the shared body size; metadata uses caption size. Journal labels must allow wrapping for the valid 40-character input limit.
- Works introduction and catalog body columns share the same starting axis. The introduction has one 48px/32px gap; catalog rows have two 24px/16px gaps, respectively.
- For theme screenshots, use the real theme toggle and wait until the body's color/background transition finishes; inherited colors can otherwise be captured midway through the transition.
