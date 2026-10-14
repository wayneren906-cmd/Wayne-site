import {authDigest,readAdminSession,sessionToken} from '../admin-auth.ts';
import {LearningAccessError} from './auth.ts';
/** Recheck native session authority within each private mutation transaction. */
export async function guardPrivateDatabase(db:D1Database,headers:Headers,date?:Date):Promise<D1Database>{
  const token=sessionToken(headers);if(!token)throw new LearningAccessError();
  const hash=await authDigest(token),now=()=>date?date.getTime()/1000:Date.now()/1000;
  const guard=()=>db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM admin_sessions s JOIN admin_accounts a ON a.account_id=s.account_id
    JOIN users u ON u.user_id=a.owner_id WHERE s.token_sha256=? AND s.expires_at>? AND s.auth_version=a.auth_version
    AND a.status='active' AND u.role='owner' AND u.status='active') THEN 1 ELSE json('session authority revoked') END AS session_guard`).bind(hash,Math.floor(now()));
  async function batch(statements:D1PreparedStatement[]){
    try{return (await db.batch([guard(),...statements])).slice(1);}catch(error){if(!await readAdminSession(headers,db,now()))throw new LearningAccessError();throw error;}
  }
  return new Proxy(db,{get(target,property){
    if(property==='batch')return batch;
    if(property==='prepare')return (sql:string)=>{
      const original=target.prepare(sql);let statement=original;
      const wrapped=new Proxy(original,{get(item,key){
        if(key==='bind')return (...values:unknown[])=>{statement=statement.bind(...values);return wrapped;};
        if(key==='run'||key==='all')return async()=> (await batch([statement]))[0];
        if(key==='first')return async(column?:string)=>{const row=(await batch([statement]))[0]?.results?.[0] as Record<string,unknown>|undefined;return column?row?.[column]??null:row??null;};
        const value=Reflect.get(statement,key);return typeof value==='function'?value.bind(statement):value;
      }});return wrapped;
    };
    const value=Reflect.get(target,property);return typeof value==='function'?value.bind(target):value;
  }});
}
