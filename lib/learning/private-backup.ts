import {z} from 'zod';
import {LearningAccessError,requireLearningPermission,learningScopes,type LearningPrincipal} from './auth.ts';
import {activeWriter,requiredWrite} from './write-support.ts';
import {LearningWriteError,normalizeLearningEvent} from './event-validation.ts';
import {checkpointSchema,deletionRestoreStatements} from './restore-deletions.ts';

const id=z.string().min(1).max(255), text=z.string(), stamp=z.string().datetime({offset:true});
const natural=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER-1), positive=natural.refine(n=>n>0);
const nullable=text.nullable();
const schemas={
  users:z.object({user_id:id,identity_issuer:text,identity_subject:id,role:z.literal('owner'),status:z.enum(['active','disabled']),created_at:stamp}).strict(),
  integration_grants:z.object({grant_id:id,owner_id:id,token_sha256:z.string().regex(/^[a-f0-9]{64}$/),scopes:text,expires_at:natural,revoked_at:stamp.nullable(),created_at:stamp}).strict(),
  learning_state:z.object({owner_id:id,data_version:natural,updated_at:stamp}).strict(),
  learning_events:z.object({event_id:id,owner_id:id,source_type:text,source_record_id:nullable,kind:text,occurred_at:stamp.nullable(),time_precision:text,received_at:stamp,
    study_day:nullable,study_day_override_reason:nullable,evidence_status:text,assistance:text,execution_mode:text,visibility:z.literal('private'),current_revision:positive}).strict(),
  event_revisions:z.object({event_id:id,owner_id:id,revision:positive,supersedes_revision:positive.nullable(),payload_json:text,actor_user_id:id,reason:z.string().min(1).max(1000),created_at:stamp}).strict(),
  ingest_receipts:z.object({receipt_id:id,owner_id:id,grant_id:id.nullable(),credential_key:text,operation:z.enum(['events:create','events:correct']),idempotency_key:id,
    payload_sha256:z.string().regex(/^[a-f0-9]{64}$/),event_id:id,revision:positive,study_day:nullable,data_version:positive,received_at:stamp,processing_status:z.literal('pending')}).strict(),
  processing_jobs:z.object({job_id:id,receipt_id:id,owner_id:id,event_id:id,revision:positive,data_version:positive,job_type:z.literal('process_event'),rule_version:text,
    status:z.enum(['pending','running','succeeded','failed','needs_attention']),attempts:natural,next_attempt_at:stamp,lease_until:stamp.nullable(),last_error_code:nullable,created_at:stamp}).strict(),
  deleted_learning_events:checkpointSchema.shape.markers.element,
  deleted_learning_keys:checkpointSchema.shape.keys.element,
};
type Table=keyof typeof schemas;
type Row=Record<string,string|number|null>;
const tables=Object.keys(schemas) as Table[];
const maxRows=150, maxBytes=4*1024*1024;
const rowsSchema=z.object({users:z.array(schemas.users).max(maxRows),integration_grants:z.array(schemas.integration_grants).max(maxRows),
  learning_state:z.array(schemas.learning_state).max(maxRows),learning_events:z.array(schemas.learning_events).max(maxRows),
  event_revisions:z.array(schemas.event_revisions).max(maxRows),ingest_receipts:z.array(schemas.ingest_receipts).max(maxRows),
  processing_jobs:z.array(schemas.processing_jobs).max(maxRows),deleted_learning_events:z.array(schemas.deleted_learning_events).max(maxRows),
  deleted_learning_keys:z.array(schemas.deleted_learning_keys).max(maxRows)}).strict();
const envelopeSchema=z.object({schema_version:z.literal(1),purpose:z.enum(['private_backup','deletion_checkpoint']),
  iv:z.string().regex(/^[a-f0-9]{24}$/),ciphertext:z.string().regex(/^[a-f0-9]+$/).max((maxBytes+16)*2)}).strict();
export type EncryptedLearningBackup=z.infer<typeof envelopeSchema>;
const hex=(bytes:Uint8Array)=>Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
const unhex=(value:string)=>Uint8Array.from(value.match(/../g)??[],pair=>Number.parseInt(pair,16));

async function encryptionKey(raw:Uint8Array){
  if(!(raw instanceof Uint8Array)||raw.byteLength!==32)throw new LearningWriteError('INVALID_INPUT');
  return crypto.subtle.importKey('raw',new Uint8Array(raw),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function seal(payload:unknown,purpose:EncryptedLearningBackup['purpose'],rawKey:Uint8Array):Promise<EncryptedLearningBackup>{
  const bytes=new TextEncoder().encode(JSON.stringify(payload));
  if(bytes.byteLength>maxBytes)throw new LearningWriteError('PAYLOAD_TOO_LARGE');
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('wayneo:v1:'+purpose)},await encryptionKey(rawKey),bytes);
  return {schema_version:1,purpose,iv:hex(iv),ciphertext:hex(new Uint8Array(ciphertext))};
}
async function open(raw:unknown,purpose:EncryptedLearningBackup['purpose'],key:Uint8Array):Promise<unknown>{
  const parsed=envelopeSchema.safeParse(raw);
  if(!parsed.success||parsed.data.purpose!==purpose||parsed.data.ciphertext.length%2)throw new LearningWriteError('INVALID_INPUT');
  try{
    const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:unhex(parsed.data.iv),additionalData:new TextEncoder().encode('wayneo:v1:'+purpose)},await encryptionKey(key),unhex(parsed.data.ciphertext));
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  }catch{throw new LearningWriteError('INVALID_INPUT');}
}
function validateRows(ownerId:string,raw:unknown):Record<Table,Row[]>{
  const parsed=rowsSchema.safeParse(raw);
  if(!parsed.success)throw new LearningWriteError('INVALID_INPUT');
  const data:Record<Table,Row[]>=parsed.data;
  if(tables.reduce((sum,t)=>sum+data[t].length,0)>maxRows||data.users.length!==1||data.users[0].user_id!==ownerId||data.learning_state.length>1
    ||tables.filter(t=>t!=='users').some(t=>data[t].some(r=>r.owner_id!==ownerId)))throw new LearningWriteError('INVALID_INPUT');
  const version=Number(data.learning_state[0]?.data_version??0);
  const grants=new Map(data.integration_grants.map(g=>[g.grant_id,g]));
  const events=new Map(data.learning_events.map(e=>[e.event_id,e]));
  const receipts=new Map(data.ingest_receipts.map(r=>[r.receipt_id,r]));
  for(const grant of data.integration_grants){
    let scopes:unknown;try{scopes=JSON.parse(String(grant.scopes));}catch{throw new LearningWriteError('INVALID_INPUT');}
    if(!Array.isArray(scopes)||scopes.length<1||scopes.length>learningScopes.length||new Set(scopes).size!==scopes.length
      ||!scopes.every(scope=>learningScopes.some(known=>known===scope)))throw new LearningWriteError('INVALID_INPUT');
  }
  if(events.size!==data.learning_events.length||grants.size!==data.integration_grants.length||receipts.size!==data.ingest_receipts.length)throw new LearningWriteError('INVALID_INPUT');
  for(const event of data.learning_events){
    const revisions=data.event_revisions.filter(r=>r.event_id===event.event_id).sort((a,b)=>Number(a.revision)-Number(b.revision));
    if(revisions.length!==event.current_revision||!version)throw new LearningWriteError('INVALID_INPUT');
    for(let i=0;i<revisions.length;i++){
      const r=revisions[i];
      if(r.revision!==i+1||r.supersedes_revision!==(i===0?null:i)||r.actor_user_id!==ownerId)throw new LearningWriteError('INVALID_INPUT');
      let normalized;try{normalized=normalizeLearningEvent(JSON.parse(String(r.payload_json)));}catch{throw new LearningWriteError('INVALID_INPUT');}
      const payload=normalized.input;
      if(payload.kind!==event.kind||payload.source.type!==event.source_type||payload.source.record_id!==event.source_record_id)throw new LearningWriteError('INVALID_INPUT');
      if(i===revisions.length-1 && (payload.occurred_at!==event.occurred_at||payload.time_precision!==event.time_precision||normalized.studyDay!==event.study_day
        ||(payload.study_day_override?.reason??null)!==event.study_day_override_reason||payload.evidence_status!==event.evidence_status||payload.assistance!==event.assistance||payload.execution_mode!==event.execution_mode))throw new LearningWriteError('INVALID_INPUT');
    }
  }
  if(data.event_revisions.some(r=>!events.has(r.event_id))||data.ingest_receipts.some(r=>!events.has(r.event_id)||Number(r.revision)>Number(events.get(r.event_id)!.current_revision)
    ||Number(r.data_version)>version||(r.grant_id!==null&&!grants.has(r.grant_id))||r.credential_key!==(r.grant_id===null?'owner':'grant:'+r.grant_id))
    ||data.processing_jobs.some(j=>{const r=receipts.get(j.receipt_id);return !r||['owner_id','event_id','revision','data_version'].some(k=>j[k]!==r[k]);}))throw new LearningWriteError('INVALID_INPUT');
  const checkpoint={schema_version:1,owners:[{owner_id:ownerId,data_version:version}],markers:data.deleted_learning_events,keys:data.deleted_learning_keys};
  // The common restore builder validates checkpoint associations before preparing mutations.
  if(data.deleted_learning_events.some(m=>Number(m.data_version)>version||data.learning_events.some(e=>e.event_id===m.event_id||(m.source_record_id!==null&&e.source_type===m.source_type&&e.source_record_id===m.source_record_id)))
    ||data.deleted_learning_keys.some(k=>!data.deleted_learning_events.some(m=>m.event_id===k.event_id))
    ||!checkpointSchema.safeParse(checkpoint).success)throw new LearningWriteError('INVALID_INPUT');
  return data;
}

/** Returns encrypted values only; no filesystem, HTTP endpoint or production backup provider. */
export async function exportPrivateLearningBackup(db:D1Database,identity:LearningPrincipal|null,key:Uint8Array,options:{now?:Date}={}){
  requireLearningPermission(identity,identity?.userId??'','events:read');
  if(identity!.kind!=='owner'||identity!.grantId!==null)throw new LearningAccessError();
  const owner=identity!.userId,now=options.now??new Date();
  if(!Number.isFinite(now.getTime()))throw new LearningWriteError('INVALID_INPUT');
  await encryptionKey(key);
  try{
    await activeWriter(db,identity!,'events:read',now);
    const query=tables.map(table=>db.prepare(`SELECT * FROM ${table} WHERE ${table==='users'?'user_id':'owner_id'}=? ORDER BY rowid LIMIT ?`).bind(owner,maxRows+1));
    const results=await db.batch([db.prepare("SELECT user_id FROM users WHERE user_id=? AND role='owner' AND status='active'").bind(owner),...query]);
    if(!results[0]?.results.length)throw new LearningAccessError();
    const data=validateRows(owner,Object.fromEntries(tables.map((t,i)=>[t,results[i+1]?.results])));
    const version=Number(data.learning_state[0]?.data_version??0);
    const checkpoint={schema_version:1,owners:[{owner_id:owner,data_version:version}],markers:data.deleted_learning_events,keys:data.deleted_learning_keys};
    return {backup:await seal({schema_version:1,owner_id:owner,exported_at:now.toISOString(),tables:data},'private_backup',key),
      checkpoint:await seal(checkpoint,'deletion_checkpoint',key),data_version:version};
  }catch(error){if(error instanceof LearningWriteError||error instanceof LearningAccessError)throw error;throw new LearningWriteError('SERVICE_UNAVAILABLE');}
}

/** Restore only to a fully empty isolated destination with schema already applied. */
export async function restorePrivateLearningBackup(db:D1Database,backup:unknown,checkpoint:unknown,key:Uint8Array,
  options:{isolated:true;expectedOwnerId:string;minimumCheckpointVersion:number;now?:Date}){
  const now=options.now??new Date();
  if(options.isolated!==true||!id.safeParse(options.expectedOwnerId).success||!natural.safeParse(options.minimumCheckpointVersion).success||!Number.isFinite(now.getTime()))throw new LearningWriteError('INVALID_INPUT');
  const decoded=await open(backup,'private_backup',key);
  const envelope=z.object({schema_version:z.literal(1),owner_id:id,exported_at:stamp,tables:z.unknown()}).strict().safeParse(decoded);
  if(!envelope.success||envelope.data.owner_id!==options.expectedOwnerId)throw new LearningWriteError('INVALID_INPUT');
  const rows=validateRows(options.expectedOwnerId,envelope.data.tables);
  const surviving=checkpointSchema.safeParse(await open(checkpoint,'deletion_checkpoint',key));
  if(!surviving.success||surviving.data.owners.length!==1||surviving.data.owners[0].owner_id!==options.expectedOwnerId
    ||surviving.data.owners[0].data_version<Math.max(options.minimumCheckpointVersion,Number(rows.learning_state[0]?.data_version??0)))throw new LearningWriteError('INVALID_INPUT');
  const owner=options.expectedOwnerId,at=now.toISOString(),statements:D1PreparedStatement[]=[];
  const write=(sql:string,values:(string|number|null)[])=>requiredWrite(db,statements,sql,values);
  statements.push(db.prepare(`SELECT CASE WHEN ${tables.map(t=>`NOT EXISTS(SELECT 1 FROM ${t})`).join(' AND ')} THEN 1 ELSE json('restore destination not empty') END AS empty_guard`));
  const insert=(table:Table,row:Row)=>{const columns=Object.keys(schemas[table].shape);write(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`,columns.map(c=>row[c]));};
  // Temporary import authority is confined to this transaction. No enabled identities commit.
  insert('users',{...rows.users[0],status:'active'});
  for(const g of rows.integration_grants)insert('integration_grants',{...g,revoked_at:null,scopes:'["events:read","context:read","events:write","events:correct"]'});
  insert('learning_state',{owner_id:owner,data_version:Number(rows.learning_state[0]?.data_version??0),updated_at:at});
  for(const e of rows.learning_events)insert('learning_events',e);
  for(const r of [...rows.event_revisions].sort((a,b)=>String(a.event_id).localeCompare(String(b.event_id))||Number(a.revision)-Number(b.revision)))insert('event_revisions',r);
  for(const r of rows.ingest_receipts){
    write('UPDATE learning_state SET data_version=? WHERE owner_id=?',[r.data_version,owner]);insert('ingest_receipts',r);
  }
  write('UPDATE learning_state SET data_version=? WHERE owner_id=?',[Number(rows.learning_state[0]?.data_version??0),owner]);
  for(const m of rows.deleted_learning_events)insert('deleted_learning_events',m);
  for(const k of rows.deleted_learning_keys)insert('deleted_learning_keys',k);
  statements.push(...deletionRestoreStatements(db,surviving.data,{isolated:true,now}));
  for(const g of rows.integration_grants)write('UPDATE integration_grants SET scopes=?,revoked_at=? WHERE grant_id=? AND owner_id=?',[g.scopes,at,g.grant_id,owner]);
  write("UPDATE users SET status='disabled' WHERE user_id=?",[owner]);
  statements.push(db.prepare('SELECT data_version FROM learning_state WHERE owner_id=?').bind(owner));
  try{
    const results=await db.batch<{data_version?:number}>(statements);const version=results.at(-1)?.results?.[0]?.data_version;
    if(typeof version!=='number'||version<=surviving.data.owners[0].data_version)throw new LearningWriteError('SERVICE_UNAVAILABLE');
    return {owner_id:owner,data_version:version,owner_status:'disabled' as const,grants_revoked:true as const,jobs_restored:0 as const};
  }catch{throw new LearningWriteError('SERVICE_UNAVAILABLE');}
}
