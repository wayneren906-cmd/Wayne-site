import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {signedOwner} from './learning-fixture.mjs';
import {hashAdminPassword,authDigest} from '../../lib/admin-auth.ts';

export function sqlStatements(sql){let text='',trigger=false;const result=[];for(const line of sql.split('\n')){text+=line+'\n';if(/^CREATE TRIGGER/i.test(line.trim()))trigger=true;if(line.trim().endsWith(';')&&(!trigger||/END;\s*$/.test(line.trim()))){result.push(text.trim());text='';trigger=false;}}assert.equal(text.trim(),'');return result;}

export async function createStudioWorkerEnvironment(){
  const root=path.resolve(import.meta.dirname,'../..');
  const {work,buildPassed}=JSON.parse(fs.readFileSync(path.join(root,'tests/.generated/worker-latest.json'),'utf8'));
  assert.equal(buildPassed,true);assert.ok(path.resolve(work).startsWith(path.join(root,'tests/.generated')+path.sep));
  const require=createRequire(fs.realpathSync(path.join(root,'node_modules/wrangler/package.json')));
  const {Miniflare,Response}=await import(pathToFileURL(require.resolve('miniflare')).href);
  const auth=await signedOwner('synthetic-sub',{aud:'synthetic-worker',exp:Math.floor(Date.now()/1000)+3600});
  const unregistered=await signedOwner('unregistered-synthetic-sub',{aud:'synthetic-worker',exp:Math.floor(Date.now()/1000)+3600},'synthetic-registration');
  const serverRoot=path.join(work,'dist/server');
  function modulesIn(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?modulesIn(path.join(directory,entry.name)):
    entry.name.endsWith('.js')||entry.name.endsWith('.mjs')?[{type:'ESModule',path:path.join(directory,entry.name)}]:[]);}
  const modules=modulesIn(serverRoot).sort((a,b)=>a.path===path.join(serverRoot,'index.js')?-1:b.path===path.join(serverRoot,'index.js')?1:a.path.localeCompare(b.path));
  let certificateRequests=0;
  const runtime=new Miniflare({rootPath:work,modules,modulesRoot:serverRoot,
    compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],host:'127.0.0.1',port:0,
    d1Databases:{DB:'synthetic-worker-only'},d1Persist:false,cachePersist:false,kvPersist:false,r2Persist:false,durableObjectsPersist:false,
    bindings:{CF_ACCESS_TEAM_DOMAIN:auth.config.CF_ACCESS_TEAM_DOMAIN,CF_ACCESS_AUD:'synthetic-worker',JOURNAL_OWNER_EMAIL:'owner@example.com'},
    assets:{directory:path.join(work,'dist/client'),binding:'ASSETS',assetConfig:{not_found_handling:'none'},routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:false}},
    outboundService:request=>{assert.equal(request.url,'https://synthetic.cloudflareaccess.com/cdn-cgi/access/certs');certificateRequests++;
      return new Response(JSON.stringify({keys:[...auth.verification.keys,...unregistered.verification.keys]}),{headers:{'content-type':'application/json'}});}});
  try{
    const db=await runtime.getD1Database('DB');
    for(const file of fs.readdirSync(path.join(work,'migrations')).filter(n=>n.endsWith('.sql')).sort())for(const sql of sqlStatements(fs.readFileSync(path.join(work,'migrations',file),'utf8')))await db.prepare(sql).run();
    await db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').bind('synthetic-owner',auth.config.CF_ACCESS_TEAM_DOMAIN,'synthetic-sub','owner','active',new Date().toISOString()).run();
    await db.prepare('INSERT INTO admin_accounts VALUES(?,?,?,?,?,?,?,?)').bind('synthetic-worker-account','synthetic-owner','owner@example.com',hashAdminPassword('Synthetic-worker-password-42'),'owner','active',1,new Date().toISOString()).run();
    await db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?,?)').bind(await authDigest(auth.cookie.split('=')[1]),'synthetic-worker-account',1,Math.floor(Date.now()/1000)+86400,new Date().toISOString()).run();
    return {runtime,db,auth,unregistered,work,certificateRequests:()=>certificateRequests};
  }catch(error){await runtime.dispose();throw error;}
}
