const fallback = '/studio/private/management';
const privatePaths = new Set([
  '/studio/private', fallback, '/studio/private/projects',
  '/studio/private/plans', '/studio/private/workspace', '/studio/private/system',
]);

/** Only return to known private pages; never accept an external redirect. */
export function studioReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')
    || /[\\\s\u0000-\u001f\u007f]/.test(value)) return fallback;
  const url = new URL(value, 'https://studio.invalid');
  if (url.origin !== 'https://studio.invalid' || value.split(/[?#]/)[0] !== url.pathname
    || !(privatePaths.has(url.pathname) || /^\/studio\/private\/record\/[a-zA-Z0-9_-]+$/.test(url.pathname))) return fallback;
  const params = new URLSearchParams();
  if (url.pathname === '/studio/private/workspace' || url.pathname === '/studio/private/projects') {
    for (const key of url.pathname.endsWith('/workspace') ? ['practice', 'project', 'milestone'] : ['project', 'milestone']) {
      const selected = url.searchParams.get(key);
      if (selected && /^[a-zA-Z0-9_-]+$/.test(selected)) params.set(key, selected);
    }
  }
  const query = params.toString();
  const hash = url.pathname === '/studio/private' && url.hash === '#supplement' ? '#supplement'
    : url.pathname === '/studio/private/projects' && /^#milestone-(interface|implementation|verification)$/.test(url.hash) ? url.hash : '';
  return url.pathname + (query ? '?' + query : '') + hash;
}

export function studioLoginHref(returnTo: string): string {
  return '/login?returnTo=' + encodeURIComponent(studioReturnTo(returnTo));
}
