// Read-only release planner. Does not stage, commit, push, publish or change Access.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const sha=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');

export function planStudioAccessExtension(app,ownerEmail,audience,hosts){
  if(app?.type!=='self_hosted'||app.aud!==audience||!app.id||!Array.isArray(app.destinations))throw Error('Access application does not match source configuration');
  const policies=app.policies??[];
  if(policies.length!==1||policies[0].decision!=='allow'||policies[0].include?.length!==1
    ||Object.keys(policies[0].include[0]).join(',')!=='email'||policies[0].include[0].email?.email?.toLowerCase()!==ownerEmail.toLowerCase())throw Error('Expected existing owner-only Access policy');
  if(app.destinations.some(d=>d.type!=='public'||!hosts.includes(d.uri.split('/')[0])||d.overrides?.length))throw Error('Unexpected destination or public bypass override');
  const additions=hosts.flatMap(host=>[host+'/studio',host+'/api/studio']).filter(uri=>!app.destinations.some(d=>d.uri===uri));
  return {app_id:app.id,add_public_paths:additions,preserve_audience:true,preserve_policy_ids:policies.map(p=>p.id),
    before_destinations:app.destinations.map(d=>d.uri),after_destinations:[...app.destinations.map(d=>d.uri),...additions]};
}

export function prepareStudioRelease(snapshot){
  const config=JSON.parse(fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8'));
  const hosts=config.routes.map(route=>route.pattern);
  const bindings=snapshot.settings?.bindings;
  if(!Array.isArray(bindings)||bindings.find(b=>b.name==='DB')?.database_id!==config.d1_databases[0].database_id)throw Error('Production database binding mismatch');
  for(const [name,text] of Object.entries(config.vars))if(bindings.find(b=>b.name===name&&b.type==='plain_text')?.text!==text)throw Error('Production identity configuration mismatch');
  const latest=snapshot.deployments?.[0];
  if(!latest?.versions?.length||latest.versions.reduce((sum,v)=>sum+v.percentage,0)!==100)throw Error('Current deployment baseline unavailable');
  const roots=['app/studio','app/api/studio','lib/learning','lib/ui','migrations','tests','docs','scripts/migration-preflight.mjs','scripts/release-preflight.mjs',
    'AGENTS.md','.gitignore','app/journal.tsx','README.md','MIGRATION-STATUS.md','VALIDATION.md'];
  const changed=execFileSync('git',['diff','--name-only','HEAD','--',...roots],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']});
  const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','--',...roots],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']});
  const files=[...new Set((changed+'\n'+untracked).split(/\r?\n/).filter(Boolean))].sort().map(name=>{
    if(name.startsWith('data/')||name.includes('/.generated/')||name.startsWith('.ccg/')||name.startsWith('screenshot')||/\.env|\.dev\.vars/.test(name))throw Error('Private/generated artifact in proposed commit');
    const full=path.resolve(root,name);if(!full.startsWith(root+path.sep)||!fs.statSync(full).isFile())throw Error('Invalid release path');
    return {path:name,sha256:sha(fs.readFileSync(full)),bytes:fs.statSync(full).size};
  });
  return {format_version:1,worker:config.name,git_head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    files,access_change:planStudioAccessExtension(snapshot.app,config.vars.JOURNAL_OWNER_EMAIL,config.vars.CF_ACCESS_AUD,hosts),
    rollback_versions:latest.versions,keep_secret_bindings:bindings.filter(b=>b.type==='secret_text').map(b=>b.name),
    preserve_routes:hosts,preserve_crons:config.triggers.crons,requires_explicit_authorization:['git_commit_push','production_worker_deploy','access_path_extension'],
    owner_registration:'verified signed identity proposal only; no owner activation or private import authorized'};
}
if(process.argv[1]===import.meta.filename){
  if(!process.argv[2])throw Error('Provide ignored live configuration snapshot JSON');
  const plan=prepareStudioRelease(JSON.parse(fs.readFileSync(path.resolve(process.argv[2]),'utf8')));
  if(process.argv[3])fs.writeFileSync(path.resolve(process.argv[3]),JSON.stringify(plan,null,2));
  console.log(JSON.stringify({worker:plan.worker,files:plan.files.length,git_head:plan.git_head,access_change:plan.access_change,rollback_versions:plan.rollback_versions,keep_secret_bindings:plan.keep_secret_bindings},null,2));
}
