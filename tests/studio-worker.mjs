// Full application build + workerd route dispatch. Only synthetic bindings and memory D1.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {input} from './helpers/learning-fixture.mjs';

const root=path.resolve(import.meta.dirname,'..');
const work=path.join(root,'tests/.generated/worker-'+Date.now());
fs.mkdirSync(work,{recursive:true});
for(const name of ['app','lib','content','worker','migrations','public','package.json','tsconfig.json','postcss.config.mjs']) {
  const source=path.join(root,name);if(fs.existsSync(source))fs.cpSync(source,path.join(work,name),{recursive:true});
}
const projectPreview=process.argv.includes('--project-preview');
if(projectPreview){
  // These routes exist only in this disposable build, never in the application's app/ tree.
  fs.cpSync(path.join(root,'tests/fixtures/studio-project-preview'),path.join(work,'app/studio/preview-wayneo'),{recursive:true});
}
fs.symlinkSync(path.join(root,'node_modules'),path.join(work,'node_modules'),'junction');
const config={name:'synthetic-studio-only',main:'worker/index.ts',compatibility_date:'2026-05-15',compatibility_flags:['nodejs_compat'],
  assets:{directory:'dist/client',binding:'ASSETS',not_found_handling:'none'},
  d1_databases:[{binding:'DB',database_name:'synthetic-studio-only',database_id:'11111111-1111-4111-8111-111111111111',migrations_dir:'migrations'}],
  vars:{CF_ACCESS_TEAM_DOMAIN:'https://synthetic.cloudflareaccess.com',CF_ACCESS_AUD:'synthetic-worker',JOURNAL_OWNER_EMAIL:'owner@example.com'}};
fs.writeFileSync(path.join(work,'wrangler.jsonc'),JSON.stringify(config,null,2));
fs.writeFileSync(path.join(work,'vite.config.ts'),`import vinext from 'vinext';import{defineConfig}from'vite';import{cloudflare}from'@cloudflare/vite-plugin';process.env.CLOUDFLARE_CF_FETCH_ENABLED='false';process.env.WRANGLER_SEND_METRICS='false';export default defineConfig({cacheDir:'.cache',plugins:[vinext(),cloudflare({viteEnvironment:{name:'rsc',childEnvironments:['ssr']},inspectorPort:false,persistState:false})]});`);
const exit=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build'],{cwd:work,windowsHide:true,stdio:'inherit',env:{...process.env,WRANGLER_LOG_PATH:path.join(work,'.logs'),WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false'}});
  child.on('error',reject);child.on('exit',resolve);
});
assert.equal(exit,0,'isolated complete application build');
fs.writeFileSync(path.join(root,'tests/.generated/worker-latest.json'),JSON.stringify({work,buildPassed:true,projectPreview}));
console.log('ISOLATED_FULL_BUILD_PASSED: '+work);
