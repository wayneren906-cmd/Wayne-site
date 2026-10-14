import {scryptSync,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {sameOrigin} from './access.ts';
import {json} from './database.ts';
const cookieName='__Host-wayneo_session',duration=8*60*60;
const email=z.string().trim().toLowerCase().email().max(254),password=z.string().min(8).max(128);
const loginSchema=z.object({email,password}).strict();
class AuthInputError extends Error{readonly status:number;constructor(status=400){super('invalid input');this.status=status;}}
const hex=(value:Uint8Array)=>Array.from(value,n=>n.toString(16).padStart(2,'0')).join('');
export const randomSession=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export async function authDigest(value:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));}
export function hashAdminPassword(value:string){
  password.parse(value);const salt=crypto.getRandomValues(new Uint8Array(16));
  const hash=scryptSync(value,salt,32,{N:16384,r:8,p:5,maxmem:32*1024*1024});
  return 'scrypt-v1$'+hex(salt)+'$'+hex(hash);
}
function checkPassword(value:string,stored:string){
  const match=/^scrypt-v1\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(stored);if(!match)return false;
  const candidate=scryptSync(value,Buffer.from(match[1],'hex'),32,{N:16384,r:8,p:5,maxmem:32*1024*1024});
  return timingSafeEqual(candidate,Buffer.from(match[2],'hex'));
}
export function sessionToken(headers:Headers){
  const values=(headers.get('cookie')??'').split(';').map(value=>value.trim()).filter(value=>value.startsWith(cookieName+'='));
  if(values.length!==1)return null;const token=values[0].slice(cookieName.length+1);return /^[a-f0-9]{64}$/.test(token)?token:null;
}
export async function readAdminSession(headers:Headers,db:D1Database,now=Date.now()/1000){
  const token=sessionToken(headers);if(!token||!Number.isFinite(now))return null;
  return db.prepare(`SELECT a.account_id,a.owner_id,a.email,a.role FROM admin_sessions s
    JOIN admin_accounts a ON a.account_id=s.account_id JOIN users u ON u.user_id=a.owner_id
    WHERE s.token_sha256=? AND s.expires_at>? AND s.auth_version=a.auth_version
    AND a.status='active' AND u.role='owner' AND u.status='active'`).bind(await authDigest(token),Math.floor(now)).first<{account_id:string;owner_id:string;email:string;role:'owner'|'admin'}>();
}
const cookie=(token:string,age:number)=>`${cookieName}=${token}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Strict`;
async function body(request:Request){
  const reader=request.body?.getReader();if(!reader)throw new AuthInputError();let bytes=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});
  try{while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>8192){try{await reader.cancel();}catch{}throw new AuthInputError(413);}text+=decoder.decode(next.value,{stream:true});}text+=decoder.decode();try{return JSON.parse(text);}catch{throw new AuthInputError();}}
  catch(error){if(error instanceof AuthInputError)throw error;throw new AuthInputError();}
  finally{reader.releaseLock();}
}
function reply(value:unknown,status=200){const response=json(value,status);response.headers.set('Vary','Cookie');return response;}
async function reserveLogin(db:D1Database,key:string,limit:number,now:number){
  const digest=await authDigest(key),window=Math.floor(now/600)*600;
  const row=await db.prepare(`INSERT INTO admin_login_limits(key_sha256,window_start,attempts) VALUES(?,?,1)
    ON CONFLICT(key_sha256) DO UPDATE SET window_start=excluded.window_start,
    attempts=CASE WHEN admin_login_limits.window_start=excluded.window_start THEN admin_login_limits.attempts+1 ELSE 1 END
    RETURNING attempts`).bind(digest,window).first<{attempts:number}>();
  return !!row&&row.attempts<=limit;
}
export async function handleAdminAuth(request:Request,db:D1Database,action:'login'|'logout'|'session'|'accounts',options:{now?:number}={}){
  const now=Math.floor(options.now??Date.now()/1000);
  try{
    if(action==='session'){
      if(request.method!=='GET')return reply({error:'不支持此方法'},405);
      const account=await readAdminSession(request.headers,db,now);return reply(account?{signed_in:true,email:account.email,role:account.role}:{signed_in:false});
    }
    if(action==='accounts'&&request.method==='GET'){
      const account=await readAdminSession(request.headers,db,now);if(account?.role!=='owner')return reply({error:'无权管理管理员账号'},403);
      const rows=await db.prepare('SELECT account_id,email,role,status FROM admin_accounts WHERE owner_id=? ORDER BY created_at,account_id').bind(account.owner_id).all();
      return reply({accounts:rows.results});
    }
    if(request.method!=='POST')return reply({error:'不支持此方法'},405);
    if(!sameOrigin(request))return reply({error:'请求来源无效'},403);
    if(action==='logout'){
      const token=sessionToken(request.headers);if(token)await db.prepare('DELETE FROM admin_sessions WHERE token_sha256=?').bind(await authDigest(token)).run();
      const response=reply({signed_in:false});response.headers.set('Set-Cookie',cookie('',0));return response;
    }
    if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return reply({error:'请提交 JSON 内容'},415);
    const raw=await body(request);
    if(action==='accounts'){
      const account=await readAdminSession(request.headers,db,now);if(account?.role!=='owner')return reply({error:'无权管理管理员账号'},403);
      const parsed=loginSchema.safeParse(raw);if(!parsed.success)return reply({error:'请填写有效邮箱及至少 8 位密码'},400);
      const accountId=crypto.randomUUID(),hash=hashAdminPassword(parsed.data.password);
      const result=await db.prepare(`INSERT INTO admin_accounts(account_id,owner_id,email,password_hash,role,status,auth_version,created_at)
        SELECT ?,?,?,?,'admin','active',1,? WHERE EXISTS(SELECT 1 FROM admin_accounts a JOIN users u ON u.user_id=a.owner_id JOIN admin_sessions s ON s.account_id=a.account_id
        WHERE a.account_id=? AND a.role='owner' AND a.status='active' AND u.role='owner' AND u.status='active'
        AND s.token_sha256=? AND s.auth_version=a.auth_version AND s.expires_at>?) ON CONFLICT(email) DO NOTHING`)
        .bind(accountId,account.owner_id,parsed.data.email,hash,new Date(now*1000).toISOString(),account.account_id,await authDigest(sessionToken(request.headers)!),now).run();
      return result.meta.changes===1?reply({created:true,email:parsed.data.email},201):reply({error:'邮箱已存在或管理权限已变化'},409);
    }
    const parsed=loginSchema.safeParse(raw);if(!parsed.success)return reply({error:'邮箱或密码不正确'},401);
    const ip=request.headers.get('cf-connecting-ip')??'unavailable';
    const [addressAllowed,ipAllowed]=await Promise.all([reserveLogin(db,'email:'+parsed.data.email,6,now),reserveLogin(db,'ip:'+ip,30,now)]);
    if(!addressAllowed||!ipAllowed){const response=reply({error:'尝试过于频繁，请稍后重试'},429);response.headers.set('Retry-After',String(600-now%600));return response;}
    const account=await db.prepare(`SELECT a.account_id,a.password_hash,a.auth_version FROM admin_accounts a JOIN users u ON u.user_id=a.owner_id
      WHERE a.email=? AND a.status='active' AND u.status='active' AND u.role='owner'`).bind(parsed.data.email).first<{account_id:string;password_hash:string;auth_version:number}>();
    const dummy='scrypt-v1$'+'0'.repeat(32)+'$'+'0'.repeat(64);
    const valid=checkPassword(parsed.data.password,account?.password_hash??dummy);
    if(!account||!valid)return reply({error:'邮箱或密码不正确'},401);
    const token=randomSession(),hash=await authDigest(token);
    const result=await db.prepare(`INSERT INTO admin_sessions(token_sha256,account_id,auth_version,expires_at,created_at)
      SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM admin_accounts a JOIN users u ON u.user_id=a.owner_id
      WHERE a.account_id=? AND a.status='active' AND a.auth_version=? AND u.status='active')`)
      .bind(hash,account.account_id,account.auth_version,now+duration,new Date(now*1000).toISOString(),account.account_id,account.auth_version).run();
    if(result.meta.changes!==1)return reply({error:'邮箱或密码不正确'},401);
    const old=sessionToken(request.headers);if(old)await db.prepare('DELETE FROM admin_sessions WHERE token_sha256=?').bind(await authDigest(old)).run();
    await db.batch([db.prepare('DELETE FROM admin_sessions WHERE expires_at<=?').bind(now),db.prepare('DELETE FROM admin_login_limits WHERE window_start<?').bind(now-86400)]);
    const response=reply({signed_in:true});response.headers.set('Set-Cookie',cookie(token,duration));return response;
  }catch(error){if(error instanceof AuthInputError)return reply({error:'请求内容无效'},error.status);return reply({error:'登录服务暂时不可用，请稍后重试'},503);}
}
