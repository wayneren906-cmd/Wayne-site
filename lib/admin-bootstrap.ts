import {z} from 'zod';
import {requiredWrite} from './learning/write-support.ts';
const id=z.string().uuid(),stamp=z.string().datetime({offset:true});
export const adminBootstrapSchema=z.object({schema_version:z.literal(1),
  owner:z.object({user_id:id,identity_issuer:z.literal('https://wayneo.dev/email'),identity_subject:id,role:z.literal('owner'),status:z.literal('active'),created_at:stamp}).strict(),
  account:z.object({account_id:id,owner_id:id,email:z.string().email().max(254).refine(value=>value===value.trim().toLowerCase()),password_hash:z.string().regex(/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/),role:z.literal('owner'),status:z.literal('active'),auth_version:z.literal(1),created_at:stamp}).strict(),
  requirements:z.array(z.string()).optional(),
}).strict().refine(value=>value.owner.user_id===value.account.owner_id&&value.owner.identity_subject===value.account.account_id);
/** Trusted operator only. Never exposed as a public registration endpoint. */
export function adminBootstrapStatements(db:D1Database,raw:unknown){
  const proposal=adminBootstrapSchema.parse(raw),statements:D1PreparedStatement[]=[];
  statements.push(db.prepare("SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users) AND NOT EXISTS(SELECT 1 FROM admin_accounts) AND NOT EXISTS(SELECT 1 FROM admin_sessions) THEN 1 ELSE json('bootstrap target not empty') END AS bootstrap_guard"));
  const owner=proposal.owner,account=proposal.account;
  requiredWrite(db,statements,'INSERT INTO users(user_id,identity_issuer,identity_subject,role,status,created_at) VALUES(?,?,?,?,?,?)',[owner.user_id,owner.identity_issuer,owner.identity_subject,owner.role,owner.status,owner.created_at]);
  requiredWrite(db,statements,'INSERT INTO admin_accounts(account_id,owner_id,email,password_hash,role,status,auth_version,created_at) VALUES(?,?,?,?,?,?,?,?)',[account.account_id,account.owner_id,account.email,account.password_hash,account.role,account.status,account.auth_version,account.created_at]);
  return statements;
}
