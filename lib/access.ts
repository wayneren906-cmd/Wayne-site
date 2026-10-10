type AuthConfig = { CF_ACCESS_TEAM_DOMAIN?: string; CF_ACCESS_AUD?: string; JOURNAL_OWNER_EMAIL?: string };
type AccessKey = JsonWebKey & { kid: string; alg?: string; use?: string };
const cache = new Map<string, { expires: number; keys: AccessKey[] }>();
export function accessIssuer(config: AuthConfig) {
  if (!config.CF_ACCESS_TEAM_DOMAIN || !config.CF_ACCESS_AUD || !config.JOURNAL_OWNER_EMAIL) throw Error("管理员登录尚未配置");
  const url = new URL(config.CF_ACCESS_TEAM_DOMAIN);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".cloudflareaccess.com") || url.username || url.password || url.port || url.search || url.hash || url.pathname !== "/") throw Error("Access 团队地址无效");
  return url.origin;
}
async function signingKeys(issuer: string) {
  const stored = cache.get(issuer);
  if (stored && stored.expires > Date.now()) return stored.keys;
  const response = await fetch(issuer + "/cdn-cgi/access/certs", { redirect: "manual" });
  if (!response.ok) throw Error("无法验证管理员身份");
  const document = await response.json() as {keys?: AccessKey[]};
  if (!Array.isArray(document.keys) || !document.keys.length) throw Error("Access 公钥无效");
  cache.set(issuer, { expires: Date.now() + 300_000, keys: document.keys });
  return document.keys;
}
function bytes(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw Error("登录凭证无效");
  const text = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(text, c => c.charCodeAt(0));
}
// Verify the signed JWT itself; forwarded email and ChatGPT headers grant no permissions.
export async function verifyOwner(token: string | null, config: AuthConfig, options: { keys?: AccessKey[]; now?: number } = {}) {
  const issuer = accessIssuer(config);
  if (!token || token.length > 16384) throw Error("请先登录管理员账户");
  const parts = token.split(".");
  if (parts.length !== 3) throw Error("登录凭证无效");
  const header = JSON.parse(new TextDecoder().decode(bytes(parts[0]))) as {alg?: string;kid?: string;crit?: unknown};
  if (header.alg !== "RS256" || !header.kid || header.crit) throw Error("登录凭证无效");
  const keys = options.keys ?? await signingKeys(issuer);
  const jwk = keys.find(k => k.kid === header.kid && k.kty === "RSA" && (!k.alg || k.alg === "RS256") && (!k.use || k.use === "sig"));
  if (!jwk) throw Error("登录凭证无效");
  const key = await crypto.subtle.importKey("jwk", jwk, {name:"RSASSA-PKCS1-v1_5", hash:"SHA-256"}, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, bytes(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!valid) throw Error("登录凭证无效");
  const claims = JSON.parse(new TextDecoder().decode(bytes(parts[1]))) as {iss?:string;aud?:string|string[];exp?:number;nbf?:number;iat?:number;email?:string};
  const now = options.now ?? Date.now()/1000;
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== issuer || !audiences.includes(config.CF_ACCESS_AUD) || typeof claims.exp !== "number" || !Number.isFinite(claims.exp) || claims.exp <= now || (claims.nbf !== undefined && (typeof claims.nbf !== "number" || claims.nbf > now)) || (claims.iat !== undefined && (typeof claims.iat !== "number" || claims.iat > now + 30))) throw Error("登录凭证已过期或不属于本站");
  if (typeof claims.email !== "string" || claims.email.trim().toLowerCase() !== config.JOURNAL_OWNER_EMAIL!.trim().toLowerCase()) throw Error("此账户无权编辑本站");
  return {email: claims.email};
}
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
