import { accessIssuer, verifyOwner } from '../access.ts';

export const learningScopes = Object.freeze(['context:read', 'events:read', 'events:write', 'events:correct'] as const);
export type LearningScope = typeof learningScopes[number];
const verifiedPrincipal = Symbol('verified learning principal');
export type LearningPrincipal = {
  readonly userId: string;
  readonly kind: 'owner' | 'integration';
  readonly grantId: string | null;
  readonly scopes: readonly LearningScope[];
  readonly [verifiedPrincipal]: true;
};

export class LearningAccessError extends Error {
  readonly code = 'PRIVATE_ACCESS_DENIED';
  constructor() {
    super('私人学习访问未获授权');
    this.name = 'LearningAccessError';
  }
}

function isScope(value: unknown): value is LearningScope {
  return typeof value === 'string' && learningScopes.some(scope => scope === value);
}

function principal(userId: string, kind: LearningPrincipal['kind'], grantId: string | null, scopes: readonly LearningScope[]): LearningPrincipal {
  const value = {userId, kind, grantId, scopes: Object.freeze([...scopes]), [verifiedPrincipal]: true as const};
  // A request payload or serialized copy must never become an authenticated principal.
  Object.defineProperty(value, verifiedPrincipal, {enumerable: false});
  return Object.freeze(value);
}

// Verification options are trusted server/test inputs, never request parameters.
// Existing administrator authorization stays unchanged; this module is not wired to a route yet.
export async function verifiedOwnerIdentity(
  token: string | null,
  config: Parameters<typeof verifyOwner>[1],
  verification?: Parameters<typeof verifyOwner>[2],
): Promise<{issuer:string;subject:string}> {
  let subject: unknown;
  try {
    await verifyOwner(token, config, verification);
    const payload = token!.split('.')[1];
    const bytes = Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as {sub?: unknown};
    subject = claims.sub;
    if (typeof subject !== 'string' || !subject || subject.length > 255 || subject.trim() !== subject || /[\u0000-\u001f\u007f]/.test(subject)) throw new LearningAccessError();
  } catch {
    throw new LearningAccessError();
  }
  return {issuer:accessIssuer(config),subject};
}

export async function verifyLearningOwner(
  token:string|null,config:Parameters<typeof verifyOwner>[1],db:D1Database,verification?:Parameters<typeof verifyOwner>[2],
):Promise<LearningPrincipal>{
  const identity=await verifiedOwnerIdentity(token,config,verification);
  const owner = await db.prepare("SELECT user_id FROM users WHERE identity_issuer=? AND identity_subject=? AND role='owner' AND status='active'")
    .bind(identity.issuer, identity.subject).first<{user_id: string}>();
  if (!owner) throw new LearningAccessError();
  return principal(owner.user_id, 'owner', null, learningScopes);
}

export async function verifyLearningGrant(token: string | null, db: D1Database, now = Date.now() / 1000): Promise<LearningPrincipal> {
  if (!token || !/^[a-f0-9]{64}$/.test(token) || !Number.isFinite(now) || now < 0) throw new LearningAccessError();
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const digest = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  const grant = await db.prepare("SELECT g.grant_id,g.owner_id,g.scopes FROM integration_grants g JOIN users u ON u.user_id=g.owner_id WHERE g.token_sha256=? AND g.revoked_at IS NULL AND g.expires_at>? AND u.role='owner' AND u.status='active'")
    .bind(digest, now).first<{grant_id: string; owner_id: string; scopes: string}>();
  if (!grant) throw new LearningAccessError();
  let scopes: unknown;
  try { scopes = JSON.parse(grant.scopes); } catch { throw new LearningAccessError(); }
  if (!Array.isArray(scopes) || !scopes.length || scopes.length > learningScopes.length || !scopes.every(isScope) || new Set(scopes).size !== scopes.length) throw new LearningAccessError();
  return principal(grant.owner_id, 'integration', grant.grant_id, scopes);
}

export function requireLearningPermission(identity: LearningPrincipal | null, ownerId: string, scope: LearningScope): void {
  if (!identity || identity[verifiedPrincipal] !== true || identity.userId !== ownerId || !isScope(scope) || !identity.scopes.includes(scope)) throw new LearningAccessError();
}
