import {z} from 'zod';
import {LearningAccessError,requireLearningPermission,learningScopes,type LearningPrincipal} from './auth.ts';
import {activeWriter,requiredWrite} from './write-support.ts';
import {LearningWriteError,normalizeLearningEvent} from './event-validation.ts';
import {checkpointSchema,deletionRestoreStatements} from './restore-deletions.ts';
import {projectIds,projectDraftSchema} from '../ui/project-protocol.ts';

const id=z.string().min(1).max(255), text=z.string(), stamp=z.string().datetime({offset:true});
const natural=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER-1), positive=natural.refine(n=>n>0);
const nullable=text.nullable();
const learningSchemas={
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
const projectSchemas={
  studio_project_records:z.object({owner_id:id,project_id:z.enum(projectIds),revision:positive,draft_json:text,private_note:z.string().max(2000),updated_at:stamp,
    published_revision:positive.nullable(),published_json:text.nullable(),published_at:stamp.nullable()}).strict(),
  studio_project_receipts:z.object({owner_id:id,idempotency_key:id,project_id:z.enum(projectIds),payload_sha256:z.string().regex(/^[a-f0-9]{64}$/),
    action:z.enum(['save_draft','publish','unpublish']),revision:positive}).strict(),
};
const schemas={...learningSchemas,...projectSchemas};
type Table=keyof typeof schemas;
type Row=Record<string,string|number|null>;
const tables=Object.keys(schemas) as Table[];
const maxRows=150, maxBytes=4*1024*1024;
const learningRowsSchema=z.object({users:z.array(schemas.users).max(maxRows),integration_grants:z.array(schemas.integration_grants).max(maxRows),
  learning_state:z.array(schemas.learning_state).max(maxRows),learning_events:z.array(schemas.learning_events).max(maxRows),
  event_revisions:z.array(schemas.event_revisions).max(maxRows),ingest_receipts:z.array(schemas.ingest_receipts).max(maxRows),
  processing_jobs:z.array(schemas.processing_jobs).max(maxRows),deleted_learning_events:z.array(schemas.deleted_learning_events).max(maxRows),
  deleted_learning_keys:z.array(schemas.deleted_learning_keys).max(maxRows)}).strict();
const rowsSchema=learningRowsSchema.extend({studio_project_records:z.array(projectSchemas.studio_project_records).max(3),
  studio_project_receipts:z.array(projectSchemas.studio_project_receipts).max(maxRows)}).strict();
const projectHeadsSchema=z.array(z.object({project_id:z.enum(projectIds),revision:positive}).strict()).max(3)
  .refine(heads=>new Set(heads.map(head=>head.project_id)).size===heads.length);
const studioCheckpointSchema=z.object({schema_version:z.literal(2),learning:checkpointSchema,project_heads:projectHeadsSchema}).strict();
const projectFloorSchema=z.object({'c-engine':positive.optional(),'embedded-controller':positive.optional(),'automotive-bus':positive.optional()}).strict();
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
function validateRows(ownerId:string,raw:unknown,format:1|2=2):Record<Table,Row[]>{
  const legacy=format===1?learningRowsSchema.safeParse(raw):null;
  if(legacy&&!legacy.success)throw new LearningWriteError('INVALID_INPUT');
  const parsed=rowsSchema.safeParse(legacy?.success?{...legacy.data,studio_project_records:[],studio_project_receipts:[]}:raw);
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
  const projects=new Map(data.studio_project_records.map(project=>[project.project_id,project]));
  if(projects.size!==data.studio_project_records.length)throw new LearningWriteError('INVALID_INPUT');
  for(const project of data.studio_project_records){
    if([project.published_revision,project.published_json,project.published_at].some(value=>value===null)
      &&![project.published_revision,project.published_json,project.published_at].every(value=>value===null))throw new LearningWriteError('INVALID_INPUT');
    if(project.published_revision!==null&&Number(project.published_revision)>Number(project.revision))throw new LearningWriteError('INVALID_INPUT');
    try{
      const checked=projectDraftSchema.parse({project_id:project.project_id,revision:project.revision,draft:JSON.parse(String(project.draft_json)),private_note:project.private_note,updated_at:project.updated_at,
        publication:project.published_json===null?null:{revision:project.published_revision,content:JSON.parse(String(project.published_json)),published_at:project.published_at}});
      if(checked.publication&&!checked.publication.content.summary)throw Error('empty publication');
    }catch{throw new LearningWriteError('INVALID_INPUT');}
  }
  const projectKeys=new Set<string>(),projectVersions=new Set<string>();
  for(const receipt of data.studio_project_receipts){
    const project=projects.get(receipt.project_id),versionKey=JSON.stringify([receipt.project_id,receipt.revision]);
    if(!project||Number(receipt.revision)>Number(project.revision)||projectKeys.has(String(receipt.idempotency_key))||projectVersions.has(versionKey))throw new LearningWriteError('INVALID_INPUT');
    projectKeys.add(String(receipt.idempotency_key));projectVersions.add(versionKey);
  }
  return data;
}

/** v2 covers learning + project rows in one authorized snapshot. Returns encrypted values only. */
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
    if(results.length!==tables.length+1||results.some(result=>!result.success||!Array.isArray(result.results)))throw new LearningWriteError('SERVICE_UNAVAILABLE');
    const data=validateRows(owner,Object.fromEntries(tables.map((t,i)=>[t,results[i+1]?.results])));
    const version=Number(data.learning_state[0]?.data_version??0);
    const checkpoint={schema_version:1,owners:[{owner_id:owner,data_version:version}],markers:data.deleted_learning_events,keys:data.deleted_learning_keys};
    const projectHeads=data.studio_project_records.map(project=>({project_id:project.project_id,revision:project.revision}));
    return {backup:await seal({schema_version:2,owner_id:owner,exported_at:now.toISOString(),tables:data},'private_backup',key),
      checkpoint:await seal({schema_version:2,learning:checkpoint,project_heads:projectHeads},'deletion_checkpoint',key),data_version:version,
      project_revisions:Object.fromEntries(projectHeads.map(project=>[String(project.project_id),Number(project.revision)]))};
  }catch(error){if(error instanceof LearningWriteError||error instanceof LearningAccessError)throw error;throw new LearningWriteError('SERVICE_UNAVAILABLE');}
}

/** Restore only to a fully empty isolated destination with schema already applied. */
export async function restorePrivateLearningBackup(db:D1Database,backup:unknown,checkpoint:unknown,key:Uint8Array,
  options:{isolated:true;expectedOwnerId:string;minimumCheckpointVersion:number;minimumProjectRevisions?:Partial<Record<typeof projectIds[number],number>>;now?:Date}){
  const now=options.now??new Date();
  if(options.isolated!==true||!id.safeParse(options.expectedOwnerId).success||!natural.safeParse(options.minimumCheckpointVersion).success||!Number.isFinite(now.getTime()))throw new LearningWriteError('INVALID_INPUT');
  const decoded=await open(backup,'private_backup',key);
  const envelope=z.object({schema_version:z.union([z.literal(1),z.literal(2)]),owner_id:id,exported_at:stamp,tables:z.unknown()}).strict().safeParse(decoded);
  if(!envelope.success||envelope.data.owner_id!==options.expectedOwnerId)throw new LearningWriteError('INVALID_INPUT');
  const rows=validateRows(options.expectedOwnerId,envelope.data.tables,envelope.data.schema_version);
  const decodedCheckpoint=await open(checkpoint,'deletion_checkpoint',key);
  const extended=studioCheckpointSchema.safeParse(decodedCheckpoint);
  const surviving=checkpointSchema.safeParse(extended.success?extended.data.learning:decodedCheckpoint);
  if(!surviving.success||surviving.data.owners.length!==1||surviving.data.owners[0].owner_id!==options.expectedOwnerId
    ||surviving.data.owners[0].data_version<Math.max(options.minimumCheckpointVersion,Number(rows.learning_state[0]?.data_version??0)))throw new LearningWriteError('INVALID_INPUT');
  const floors=projectFloorSchema.safeParse(options.minimumProjectRevisions??{});
  if(!floors.success||envelope.data.schema_version===2&&!extended.success)throw new LearningWriteError('INVALID_INPUT');
  const heads=extended.success?extended.data.project_heads:[];
  if(heads.length!==rows.studio_project_records.length||Object.keys(floors.data).length!==heads.length)throw new LearningWriteError('INVALID_INPUT');
  const restoredProjectVersions=new Map<string,number>();
  for(const head of heads){
    const project=rows.studio_project_records.find(row=>row.project_id===head.project_id),floor=floors.data[head.project_id];
    if(!project||floor===undefined||head.revision<Math.max(floor,Number(project.revision))||head.revision>=Number.MAX_SAFE_INTEGER-1)throw new LearningWriteError('INVALID_INPUT');
    restoredProjectVersions.set(head.project_id,head.revision+1);
  }
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
  // Publications remain in the encrypted archive, but are never automatically republished by restore.
  for(const project of rows.studio_project_records){
    insert('studio_project_records',{...project,published_revision:null,published_json:null,published_at:null});
    const receipts=rows.studio_project_receipts.filter(receipt=>receipt.project_id===project.project_id).sort((a,b)=>Number(a.revision)-Number(b.revision));
    for(const receipt of receipts){
      // Historical receipts must pass the same in-transaction version trigger as normal writes.
      write('UPDATE studio_project_records SET revision=? WHERE owner_id=? AND project_id=?',[receipt.revision,owner,project.project_id]);
      insert('studio_project_receipts',receipt);
    }
    write('UPDATE studio_project_records SET revision=?,updated_at=? WHERE owner_id=? AND project_id=?',[restoredProjectVersions.get(String(project.project_id))!,at,owner,project.project_id]);
  }
  statements.push(...deletionRestoreStatements(db,surviving.data,{isolated:true,now}));
  for(const g of rows.integration_grants)write('UPDATE integration_grants SET scopes=?,revoked_at=? WHERE grant_id=? AND owner_id=?',[g.scopes,at,g.grant_id,owner]);
  write("UPDATE users SET status='disabled' WHERE user_id=?",[owner]);
  for(const [projectId,revision] of restoredProjectVersions)statements.push(db.prepare(`SELECT CASE WHEN EXISTS(
    SELECT 1 FROM studio_project_records WHERE owner_id=? AND project_id=? AND revision=?
    AND published_revision IS NULL AND published_json IS NULL AND published_at IS NULL
  ) THEN 1 ELSE json('invalid restored project') END AS project_restore_guard`).bind(owner,projectId,revision));
  statements.push(db.prepare('SELECT data_version FROM learning_state WHERE owner_id=?').bind(owner));
  try{
    const results=await db.batch<{data_version?:number}>(statements);const version=results.at(-1)?.results?.[0]?.data_version;
    if(typeof version!=='number'||version<=surviving.data.owners[0].data_version)throw new LearningWriteError('SERVICE_UNAVAILABLE');
    return {owner_id:owner,data_version:version,owner_status:'disabled' as const,grants_revoked:true as const,jobs_restored:0 as const,
      projects_restored:rows.studio_project_records.length,project_publications_restored:0 as const,
      project_revisions:Object.fromEntries(restoredProjectVersions)};
  }catch{throw new LearningWriteError('SERVICE_UNAVAILABLE');}
}
