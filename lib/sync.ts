import { timingSafeEqual } from 'node:crypto';
import { json, readRecords } from './database.ts';
import { recordSchema } from './records.ts';

type SyncEnv = { DB: D1Database; SYNC_TOKEN_SHA256?: string };
const maxBytes = 64 * 1024;

async function authorized(request: Request, expected: string) {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer ([a-f0-9]{64})$/.exec(header);
  if (!match) return false;
  const provided = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(match[1]));
  return timingSafeEqual(new Uint8Array(provided), Buffer.from(expected, 'hex'));
}

async function boundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function handleSync(request: Request, env: SyncEnv): Promise<Response> {
  if (!env.SYNC_TOKEN_SHA256 || !/^[a-f0-9]{64}$/.test(env.SYNC_TOKEN_SHA256)) return json({error:'自动同步尚未配置'},503);
  if (!await authorized(request,env.SYNC_TOKEN_SHA256)) return json({error:'同步凭证无效'},401);
  if (request.method === 'GET') return json({records:await readRecords(env.DB)});
  if (request.method !== 'POST') return json({error:'不支持此方法'},405);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return json({error:'请提交 JSON'},415);
  const text = await boundedBody(request);
  if (text === null) return json({error:'学习记录超过大小限制'},413);
  let body;
  try { body = recordSchema.parse(JSON.parse(text)); } catch { return json({error:'请检查日期和学习内容'},400); }
  const current = (await readRecords(env.DB)).find(record=>record.date === body.date);
  if (current && (body.expectedRevision === current.revision || body.expectedRevision + 1 === current.revision)
      && JSON.stringify(current.items) === JSON.stringify(body.items) && current.practice === body.practice) {
    return json({record:current,unchanged:true});
  }
  const now = new Date().toISOString();
  const result = body.expectedRevision === 0
    ? await env.DB.prepare('INSERT INTO records(date,items,practice,revision,updated_at) VALUES(?,?,?,1,?) ON CONFLICT(date) DO NOTHING').bind(body.date,JSON.stringify(body.items),body.practice,now).run()
    : await env.DB.prepare('UPDATE records SET items=?,practice=?,revision=revision+1,updated_at=? WHERE date=? AND revision=?').bind(JSON.stringify(body.items),body.practice,now,body.date,body.expectedRevision).run();
  if (!result.meta.changes) return json({error:'记录版本已变化，停止自动覆盖'},409);
  const record = (await readRecords(env.DB)).find(entry=>entry.date === body.date);
  return json({record,unchanged:false});
}
