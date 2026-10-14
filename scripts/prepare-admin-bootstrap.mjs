// Trusted offline initializer. Reads one JSON line from stdin; never prints the password or hash.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {z} from 'zod';
import {hashAdminPassword} from '../lib/admin-auth.ts';
const root=path.resolve(import.meta.dirname,'..'),destination=path.resolve(process.argv[2]??path.join(root,'data/admin-bootstrap.json'));
if(!destination.startsWith(path.join(root,'data')+path.sep))throw Error('Initializer output must stay in ignored data/');
const input=readline.createInterface({input:process.stdin,terminal:false});
input.once('line',line=>{
  input.close();const parsed=z.object({email:z.string().trim().toLowerCase().email().max(254),password:z.string().min(8).max(128)}).strict().parse(JSON.parse(line));
  const ownerId=crypto.randomUUID(),accountId=crypto.randomUUID(),at=new Date().toISOString();
  const proposal={schema_version:1,owner:{user_id:ownerId,identity_issuer:'https://wayneo.dev/email',identity_subject:accountId,role:'owner',status:'active',created_at:at},
    account:{account_id:accountId,owner_id:ownerId,email:parsed.email,password_hash:hashAdminPassword(parsed.password),role:'owner',status:'active',auth_version:1,created_at:at},
    requirements:['migrations_0001_to_0008_applied','empty_users_and_admin_accounts','single_atomic_batch','explicit_production_authorization']};
  fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(proposal,null,2));
  console.log(JSON.stringify({prepared:true,email:proposal.account.email,role:'owner',credentials:'salted scrypt hash only; no plaintext stored',output:path.relative(root,destination)}));
});
