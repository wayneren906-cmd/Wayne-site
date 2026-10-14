import {sameOrigin} from '../access.ts';
import {json} from '../database.ts';
import {LearningAccessError, verifyLearningOwner, verifyStudioSession} from './auth.ts';
import {LearningWriteError} from './event-validation.ts';
import {correctLearningEvent, saveLearningEvent} from './events.ts';
import {deleteLearningEvent} from './deletions.ts';
import {getStudioProjectDrafts,mutateStudioProject} from '../studio-projects.ts';
import {getStudioPlanDrafts,mutateStudioPlan} from '../studio-plans.ts';
import {guardPrivateDatabase} from './session-db.ts';
import {getLearningContext, getLearningEvent, getLearningEventHistory, getStudioManagement, LearningReadError} from './reads.ts';
import type {ContextPurpose, LearningAPIErrorCode, LearningAPIErrorDTO} from './contracts.ts';

type StudioEnv = Parameters<typeof verifyLearningOwner>[1] & {DB: D1Database};
type ServerOptions = {now?: Date; verification?: Parameters<typeof verifyLearningOwner>[3]};
const statuses: Record<LearningAPIErrorCode, number> = {
  PRIVATE_ACCESS_DENIED: 403, INVALID_INPUT: 400, IDEMPOTENCY_CONFLICT: 409,
  REVISION_CONFLICT: 409, PAYLOAD_TOO_LARGE: 413, RATE_LIMITED: 429, SERVICE_UNAVAILABLE: 503,
  EVENT_DELETED: 409, EVENT_NOT_FOUND: 404,
};

function errorResponse(code: LearningAPIErrorCode, message: string, status = statuses[code]) {
  const payload: LearningAPIErrorDTO = {error: {code, message}};
  const response = json(payload, status);
  response.headers.set('Vary', 'Cookie');
  return response;
}

function failed(error: unknown) {
  if (error instanceof LearningAccessError || error instanceof LearningWriteError || error instanceof LearningReadError) return errorResponse(error.code, error.message);
  return errorResponse('SERVICE_UNAVAILABLE', '私人学习服务暂时不可用，请稍后重试');
}

async function owner(request: Request, env: StudioEnv, options: ServerOptions) {
  // HTTP Studio is browser-owner only. Grant authentication belongs to a separately
  // scoped integration adapter, not a bearer fallback for this browser endpoint.
  return verifyStudioSession(request.headers,env.DB,options.now?options.now.getTime()/1000:undefined);
}

function missingIdentity(request: Request) {
  return request.headers.get('cookie') ? null : errorResponse('PRIVATE_ACCESS_DENIED', '请先使用所有者账户登录', 401);
}

async function boundedJSON(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new LearningWriteError('INVALID_INPUT');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64 * 1024) {
        // A failed stream cleanup must not change the known size-limit rejection.
        try {await reader.cancel();} catch {}
        throw new LearningWriteError('PAYLOAD_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
  try {return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));}
  catch {throw new LearningWriteError('INVALID_INPUT');}
}

export async function handleStudioEvents(request: Request, env: StudioEnv, options: ServerOptions = {}): Promise<Response> {
  const denied = missingIdentity(request); if (denied) return denied;
  try {
    const identity = await owner(request, env, options);
    env={...env,DB:await guardPrivateDatabase(env.DB,request.headers,options.now)};
    if (request.method !== 'POST') return errorResponse('INVALID_INPUT', '不支持此方法', 405);
    if (!sameOrigin(request)) return errorResponse('PRIVATE_ACCESS_DENIED', '请求来源无效');
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return errorResponse('INVALID_INPUT', '请提交JSON内容', 415);
    const receipt = await saveLearningEvent(env.DB, identity, await boundedJSON(request), {now: options.now});
    return json(receipt, receipt.replayed ? 200 : 201);
  } catch (error) {return failed(error);}
}

export async function handleStudioEvent(request: Request, env: StudioEnv, eventId: string, options: ServerOptions = {}): Promise<Response> {
  const denied = missingIdentity(request); if (denied) return denied;
  try {
    const identity = await owner(request, env, options);
    env={...env,DB:await guardPrivateDatabase(env.DB,request.headers,options.now)};
    if (request.method === 'PATCH' || request.method === 'DELETE') {
      if (!sameOrigin(request)) return errorResponse('PRIVATE_ACCESS_DENIED', '请求来源无效');
      if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return errorResponse('INVALID_INPUT', '请提交JSON内容', 415);
      const body = await boundedJSON(request);
      if (request.method === 'DELETE') return json(await deleteLearningEvent(env.DB, identity, eventId, body, {now: options.now}));
      const receipt = await correctLearningEvent(env.DB, identity, eventId, body, {now: options.now});
      return json(receipt, receipt.replayed ? 200 : 201);
    }
    if (request.method !== 'GET') return errorResponse('INVALID_INPUT', '不支持此方法', 405);
    const event = await getLearningEvent(env.DB, identity, eventId, {now: options.now});
    // Use the existing v1 error vocabulary, with identical missing/foreign responses.
    return event ? json(event) : errorResponse('INVALID_INPUT', '学习事件不存在或不可访问', 404);
  } catch (error) {return failed(error);}
}

export async function handleStudioEventHistory(request: Request, env: StudioEnv, eventId: string, options: ServerOptions = {}): Promise<Response> {
  const denied = missingIdentity(request); if (denied) return denied;
  try {
    const identity = await owner(request, env, options);
    env={...env,DB:await guardPrivateDatabase(env.DB,request.headers,options.now)};
    if (request.method !== 'GET') return errorResponse('INVALID_INPUT', '不支持此方法', 405);
    const query = new URL(request.url).searchParams;
    if ([...query.keys()].some(key => key !== 'before_revision') || query.getAll('before_revision').length > 1) throw new LearningReadError('INVALID_INPUT');
    const cursor = query.get('before_revision');
    if (cursor !== null && (!/^[1-9]\d*$/.test(cursor) || !Number.isSafeInteger(Number(cursor)))) throw new LearningReadError('INVALID_INPUT');
    const history = await getLearningEventHistory(env.DB, identity, eventId, cursor === null ? {} : {before_revision: Number(cursor)}, {now: options.now});
    return history ? json(history) : errorResponse('INVALID_INPUT', '学习事件不存在或不可访问', 404);
  } catch (error) {return failed(error);}
}

export async function handleStudioContext(request: Request, env: StudioEnv, options: ServerOptions = {}): Promise<Response> {
  const denied = missingIdentity(request); if (denied) return denied;
  try {
    const identity = await owner(request, env, options);
    env={...env,DB:await guardPrivateDatabase(env.DB,request.headers,options.now)};
    if (request.method !== 'GET') return errorResponse('INVALID_INPUT', '不支持此方法', 405);
    const query = new URL(request.url).searchParams;
    if ([...query.keys()].some(key => key !== 'purpose') || query.getAll('purpose').length > 1) throw new LearningReadError('INVALID_INPUT');
    const purpose = (query.get('purpose') ?? 'teaching') as ContextPurpose;
    return json(await getLearningContext(env.DB, identity, purpose, {now: options.now}));
  } catch (error) {return failed(error);}
}

export async function handleStudioRegistration(request:Request,env:StudioEnv,options:ServerOptions={}):Promise<Response>{
  return errorResponse('PRIVATE_ACCESS_DENIED','旧登录登记流程已停用，请使用邮箱登录',410);
}

export async function handleStudioManagement(request:Request,env:StudioEnv,options:ServerOptions={}):Promise<Response>{
  const denied=missingIdentity(request);if(denied)return denied;
  try{
    const identity=await owner(request,env,options);
    env={...env,DB:await guardPrivateDatabase(env.DB,request.headers,options.now)};
    if(request.method!=='GET')return errorResponse('INVALID_INPUT','不支持此方法',405);
    if([...new URL(request.url).searchParams].length)throw new LearningReadError('INVALID_INPUT');
    const response=json(await getStudioManagement(env.DB,identity,{now:options.now}));
    response.headers.set('Vary','Cookie');
    return response;
  }catch(error){return failed(error);}
}

export async function handleStudioProjects(request:Request,env:StudioEnv,options:ServerOptions={}):Promise<Response>{
  const denied=missingIdentity(request);if(denied)return denied;
  try{
    const identity=await owner(request,env,options);
    env={...env,DB:await guardPrivateDatabase(env.DB,request.headers,options.now)};
    if([...new URL(request.url).searchParams].length)throw new LearningWriteError('INVALID_INPUT');
    let response:Response;
    if(request.method==='GET')response=json({projects:await getStudioProjectDrafts(env.DB,identity)});
    else if(request.method==='POST'){
      if(!sameOrigin(request))return errorResponse('PRIVATE_ACCESS_DENIED','请求来源无效');
      if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return errorResponse('INVALID_INPUT','请提交JSON内容',415);
      response=json(await mutateStudioProject(env.DB,identity,await boundedJSON(request),{now:options.now}));
    }else return errorResponse('INVALID_INPUT','不支持此方法',405);
    response.headers.set('Vary','Cookie');return response;
  }catch(error){return failed(error);}
}

export async function handleStudioPlans(request:Request,env:StudioEnv,options:ServerOptions={}):Promise<Response>{
  const denied=missingIdentity(request);if(denied)return denied;
  try{
    const identity=await owner(request,env,options);
    env={...env,DB:await guardPrivateDatabase(env.DB,request.headers,options.now)};
    if([...new URL(request.url).searchParams].length)throw new LearningWriteError('INVALID_INPUT');
    let response:Response;
    if(request.method==='GET')response=json({plans:await getStudioPlanDrafts(env.DB,identity)});
    else if(request.method==='POST'){
      if(!sameOrigin(request))return errorResponse('PRIVATE_ACCESS_DENIED','请求来源无效');
      if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return errorResponse('INVALID_INPUT','请提交JSON内容',415);
      response=json(await mutateStudioPlan(env.DB,identity,await boundedJSON(request),{now:options.now}));
    }else return errorResponse('INVALID_INPUT','不支持此方法',405);
    response.headers.set('Vary','Cookie');return response;
  }catch(error){return failed(error);}
}
