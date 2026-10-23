import {LearningAccessError,requireLearningPermission,type LearningPrincipal} from './learning/auth.ts';
import {LearningWriteError} from './learning/event-validation.ts';
import {activeWriter,payloadHash,requiredWrite} from './learning/write-support.ts';
import {projectContentSchema,projectDraftSchema,projectMutationSchema,projectReceiptSchema} from './ui/project-protocol.ts';
import type {StudioProjectDraftDTO,StudioProjectPublicDTO,StudioProjectReceiptDTO} from './learning/contracts.ts';

type ProjectRow={project_id:string;revision:number;draft_json:string;private_note:string;updated_at:string;published_revision:number|null;published_json:string|null;published_at:string|null};
type ReceiptRow={project_id:string;revision:number;action:'save_draft'|'publish'|'unpublish';payload_sha256:string};
function ownerOnly(identity:LearningPrincipal|null,scope:'events:read'|'events:write'){
  requireLearningPermission(identity,identity?.userId??'',scope);
  if(identity!.kind!=='owner'||identity!.grantId!==null)throw new LearningAccessError();
}
async function ownerSnapshot(db:D1Database,identity:LearningPrincipal,queries:D1PreparedStatement[]){
  const results=await db.batch([db.prepare("SELECT user_id FROM users WHERE user_id=? AND role='owner' AND status='active'").bind(identity.userId),...queries]);
  if(!results[0]?.results?.length)throw new LearningAccessError();
  if(results.length!==queries.length+1||results.some(result=>!result.success||!Array.isArray(result.results)))throw new LearningWriteError('SERVICE_UNAVAILABLE');
  return results.slice(1);
}
const rowQuery=(db:D1Database,identity:LearningPrincipal,projectId:string)=>db.prepare('SELECT project_id,revision,draft_json,private_note,updated_at,published_revision,published_json,published_at FROM studio_project_records WHERE owner_id=? AND project_id=?').bind(identity.userId,projectId);
const receiptQuery=(db:D1Database,identity:LearningPrincipal,key:string)=>db.prepare('SELECT project_id,revision,action,payload_sha256 FROM studio_project_receipts WHERE owner_id=? AND idempotency_key=?').bind(identity.userId,key);
function draftDTO(row:ProjectRow):StudioProjectDraftDTO{
  if((row.published_revision===null)!==(row.published_json===null)||row.published_revision!==null&&row.published_revision>row.revision)throw new LearningWriteError('SERVICE_UNAVAILABLE');
  return projectDraftSchema.parse({project_id:row.project_id,revision:row.revision,draft:JSON.parse(row.draft_json),private_note:row.private_note,updated_at:row.updated_at,publication:row.published_json===null?null:{revision:row.published_revision,content:JSON.parse(row.published_json),published_at:row.published_at}});
}
function receiptDTO(row:ReceiptRow,hash:string,replayed:boolean):StudioProjectReceiptDTO{
  if(row.payload_sha256!==hash)throw new LearningWriteError('IDEMPOTENCY_CONFLICT');
  return projectReceiptSchema.parse({project_id:row.project_id,revision:row.revision,action:row.action,saved:true,replayed});
}
function failed(error:unknown):never{
  if(error instanceof LearningAccessError||error instanceof LearningWriteError)throw error;
  throw new LearningWriteError('SERVICE_UNAVAILABLE');
}
export async function getStudioProjectDrafts(db:D1Database,identity:LearningPrincipal|null):Promise<StudioProjectDraftDTO[]>{
  ownerOnly(identity,'events:read');
  try{
    const [rows]=await ownerSnapshot(db,identity!,[db.prepare('SELECT project_id,revision,draft_json,private_note,updated_at,published_revision,published_json,published_at FROM studio_project_records WHERE owner_id=? ORDER BY project_id').bind(identity!.userId)]);
    return (rows.results as ProjectRow[]).map(draftDTO);
  }catch(error){return failed(error);}
}
export async function readPublicStudioProjects(db:D1Database):Promise<StudioProjectPublicDTO[]>{
  try{
    // A new draft cannot alter the published snapshot. Disabled owners' publications are hidden.
    const rows=await db.prepare(`SELECT project_id,published_revision,published_json,published_at FROM (
      SELECT p.project_id,p.published_revision,p.published_json,p.published_at,
        ROW_NUMBER() OVER(PARTITION BY p.project_id ORDER BY p.published_at DESC,p.owner_id) AS position
      FROM studio_project_records p JOIN users u ON u.user_id=p.owner_id
      WHERE u.role='owner' AND u.status='active' AND p.published_json IS NOT NULL
    ) WHERE position=1 ORDER BY project_id`).all<Pick<ProjectRow,'project_id'|'published_revision'|'published_json'|'published_at'>>();
    if(!rows.success)throw new LearningWriteError('SERVICE_UNAVAILABLE');
    return rows.results.map(row=>{
      const content=projectContentSchema.parse(JSON.parse(row.published_json!));
      if(!content.summary)throw new LearningWriteError('SERVICE_UNAVAILABLE');
      // A published Wayneo snapshot is public only with a saved, non-empty introduction.
      if(row.project_id==='wayneo'&&!content.description)throw new LearningWriteError('SERVICE_UNAVAILABLE');
      const checked=projectDraftSchema.parse({project_id:row.project_id,revision:row.published_revision,draft:content,private_note:'',updated_at:row.published_at,publication:{revision:row.published_revision,content,published_at:row.published_at}});
      return {project_id:checked.project_id,revision:checked.publication!.revision,content,published_at:checked.publication!.published_at};
    });
  }catch(error){return failed(error);}
}
export async function mutateStudioProject(db:D1Database,identity:LearningPrincipal|null,raw:unknown,options:{now?:Date}={}):Promise<StudioProjectReceiptDTO>{
  ownerOnly(identity,'events:write');
  const now=options.now??new Date(),parsed=projectMutationSchema.safeParse(raw);
  if(!parsed.success||!Number.isFinite(now.getTime()))throw new LearningWriteError('INVALID_INPUT');
  const input=parsed.data,owner=identity!,hash=await payloadHash(JSON.stringify(input));
  if(input.expected_revision>=Number.MAX_SAFE_INTEGER-1)throw new LearningWriteError('INVALID_INPUT');
  const current=async()=>{
    const [receipts,projects]=await ownerSnapshot(db,owner,[receiptQuery(db,owner,input.idempotency_key),rowQuery(db,owner,input.project_id)]);
    return {receipt:receipts.results[0] as ReceiptRow|undefined,row:projects.results[0] as ProjectRow|undefined};
  };
  try{
    const before=await current();
    if(before.receipt)return receiptDTO(before.receipt,hash,true);
    if((before.row?.revision??0)!==input.expected_revision)throw new LearningWriteError('REVISION_CONFLICT');
    const revision=input.expected_revision+1,at=now.toISOString(),statements:D1PreparedStatement[]=[];
    if(input.action==='save_draft'){
      const {private_note,...candidate}=input.content;
      const draft=JSON.stringify(projectContentSchema.parse(candidate));
      if(input.expected_revision===0)requiredWrite(db,statements,'INSERT INTO studio_project_records(owner_id,project_id,revision,draft_json,private_note,updated_at) VALUES(?,?,?,?,?,?)',[owner.userId,input.project_id,revision,draft,private_note,at]);
      else requiredWrite(db,statements,'UPDATE studio_project_records SET revision=?,draft_json=?,private_note=?,updated_at=? WHERE owner_id=? AND project_id=? AND revision=?',[revision,draft,private_note,at,owner.userId,input.project_id,input.expected_revision]);
    }else{
      if(!before.row)throw new LearningWriteError('REVISION_CONFLICT');
      const dto=draftDTO(before.row);
      if(input.action==='publish'){
        if(!dto.draft.summary)throw new LearningWriteError('INVALID_INPUT');
        // Wayneo must be published with its saved introduction; an incomplete private draft is still allowed.
        if(input.project_id==='wayneo'&&!dto.draft.description)throw new LearningWriteError('INVALID_INPUT');
        requiredWrite(db,statements,'UPDATE studio_project_records SET revision=?,updated_at=?,published_revision=?,published_json=?,published_at=? WHERE owner_id=? AND project_id=? AND revision=?',[revision,at,revision,JSON.stringify(dto.draft),at,owner.userId,input.project_id,input.expected_revision]);
      }else requiredWrite(db,statements,'UPDATE studio_project_records SET revision=?,updated_at=?,published_revision=NULL,published_json=NULL,published_at=NULL WHERE owner_id=? AND project_id=? AND revision=?',[revision,at,owner.userId,input.project_id,input.expected_revision]);
    }
    requiredWrite(db,statements,'INSERT INTO studio_project_receipts(owner_id,idempotency_key,project_id,payload_sha256,action,revision) VALUES(?,?,?,?,?,?)',[owner.userId,input.idempotency_key,input.project_id,hash,input.action,revision]);
    statements.push(receiptQuery(db,owner,input.idempotency_key));
    try{
      const results=await db.batch<ReceiptRow>(statements),receipt=results.at(-1)?.results?.[0];
      if(!receipt)throw new LearningWriteError('SERVICE_UNAVAILABLE');
      return receiptDTO(receipt,hash,false);
    }catch{
      await activeWriter(db,owner,'events:write',now);
      const after=await current();
      if(after.receipt)return receiptDTO(after.receipt,hash,true);
      if((after.row?.revision??0)!==input.expected_revision)throw new LearningWriteError('REVISION_CONFLICT');
      throw new LearningWriteError('SERVICE_UNAVAILABLE');
    }
  }catch(error){return failed(error);}
}
