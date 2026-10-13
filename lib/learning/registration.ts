import {verifiedOwnerIdentity} from './auth.ts';
import {LearningWriteError} from './event-validation.ts';

/** Only prepares an identity verified by the existing owner-email Access policy.
 * Does not register/activate any user, return a JWT or expose learning facts.
 */
export async function prepareOwnerRegistration(token:string|null,config:Parameters<typeof verifiedOwnerIdentity>[1],db:D1Database,
  options:{now?:Date;verification?:Parameters<typeof verifiedOwnerIdentity>[2]}={}){
  const identity=await verifiedOwnerIdentity(token,config,options.verification),now=options.now??new Date();
  if(!Number.isFinite(now.getTime()))throw new LearningWriteError('INVALID_INPUT');
  const existing=await db.prepare('SELECT user_id,role,status FROM users WHERE identity_issuer=? AND identity_subject=?')
    .bind(identity.issuer,identity.subject).first<{user_id:string;role:string;status:string}>();
  if(existing)return {registration_required:false as const,status:existing.status==='active'&&existing.role==='owner'?'registered' as const:'requires_operator_review' as const};
  return {registration_required:true as const,status:'pending_operator_confirmation' as const,
    proposal:{user_id:crypto.randomUUID(),identity_issuer:identity.issuer,identity_subject:identity.subject,role:'owner' as const,status:'disabled' as const,created_at:now.toISOString()}};
}
