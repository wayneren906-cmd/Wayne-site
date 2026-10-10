import test from "node:test";
import assert from "node:assert/strict";
import { verifyOwner, sameOrigin } from "../lib/access.ts";
import { learningDate } from "../lib/records.ts";
import { importSQL } from "../scripts/import-sql.mjs";
const config={CF_ACCESS_TEAM_DOMAIN:"https://wayne-test.cloudflareaccess.com",CF_ACCESS_AUD:"test-app",JOURNAL_OWNER_EMAIL:"owner@example.com"};
const pair=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
const jwk={...await crypto.subtle.exportKey("jwk",pair.publicKey),kid:"test-key"};
const options={keys:[jwk],now:1000};
const b64=value=>Buffer.from(value).toString("base64url");
async function token(changes={},headerChanges={}){
 const header=b64(JSON.stringify({alg:"RS256",kid:"test-key",...headerChanges}));
 const payload=b64(JSON.stringify({iss:config.CF_ACCESS_TEAM_DOMAIN,aud:[config.CF_ACCESS_AUD],exp:2000,iat:900,email:config.JOURNAL_OWNER_EMAIL,...changes}));
 const text=header+"."+payload;
 const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",pair.privateKey,new TextEncoder().encode(text));
 return text+"."+b64(signature);
}
test("valid Access identity admits owner",async()=>assert.equal((await verifyOwner(await token(),config,options)).email,config.JOURNAL_OWNER_EMAIL));

test("Workers-compatible key retrieval rejects redirects and verifies direct keys",async()=>{
 const originalFetch=globalThis.fetch;
 try {
  globalThis.fetch=async(url,init)=>{
   assert.equal(url,config.CF_ACCESS_TEAM_DOMAIN+"/cdn-cgi/access/certs");
   assert.equal(init.redirect,"manual");
   return new Response(null,{status:302,headers:{Location:"https://other.example/certs"}});
  };
  await assert.rejects(verifyOwner(await token(),config,{now:1000}),/无法验证管理员身份/);
  globalThis.fetch=async(url,init)=>{
   assert.equal(init.redirect,"manual");
   return Response.json({keys:[jwk]});
  };
  assert.equal((await verifyOwner(await token(),config,{now:1000})).email,config.JOURNAL_OWNER_EMAIL);
 } finally {globalThis.fetch=originalFetch;}
});
test("missing config/token and wrong email/audience/issuer/expiry are denied",async()=>{
 await assert.rejects(verifyOwner(null,config,options));await assert.rejects(verifyOwner(await token(),{},options));
 for(const changes of [{email:"visitor@example.com"},{aud:["another-app"]},{iss:"https://other.cloudflareaccess.com"},{exp:1000},{exp:null},{nbf:1001},{iat:1031}]){
  await assert.rejects(verifyOwner(await token(changes),config,options));
 }
});
test("tampering, unsigned tokens and unknown signing keys are denied",async()=>{
 const original=await token();const parts=original.split(".");
 const altered=parts[0]+"."+b64(JSON.stringify({email:config.JOURNAL_OWNER_EMAIL}))+"."+parts[2];
 await assert.rejects(verifyOwner(altered,config,options));
 await assert.rejects(verifyOwner(await token({}, {alg:"none"}),config,options));
 await assert.rejects(verifyOwner(await token({}, {kid:"unknown"}),config,options));
});
test("only same-origin browser mutations are allowed",()=>{
 const req=origin=>new Request("https://wayne.kdns.fr/api/admin/records",{method:"POST",headers:origin?{Origin:origin}:{}});
 assert.equal(sameOrigin(req("https://wayne.kdns.fr")),true);
 assert.equal(sameOrigin(req("https://attacker.example")),false);
 assert.equal(sameOrigin(req(null)),false);
});
test("study day changes at Beijing 06:00",()=>{
 assert.equal(learningDate(new Date("2026-10-10T05:59:59+08:00")),"2026-10-09");
 assert.equal(learningDate(new Date("2026-10-10T06:00:00+08:00")),"2026-10-10");
});
test("data migration escapes text and preserves existing dates",()=>{
 const r={date:"2026-10-09",items:[{label:"C",text:"it's useful"}],practice:"'",revision:2,updatedAt:"2026-10-09T15:00:00Z"};
 const sql=importSQL({formatVersion:1,records:[r],snapshots:[{date:r.date,records:[r],updatedAt:r.updatedAt}]});
 assert.ok(sql.includes("it''s useful"));assert.equal(sql.match(/ON CONFLICT\(date\) DO NOTHING/g).length,2);
 assert.ok(!sql.includes("BEGIN TRANSACTION"));assert.ok(!sql.includes("COMMIT;"));
 assert.throws(()=>importSQL({formatVersion:1,records:[{...r,date:"2026-02-30"}],snapshots:[]}));
});
