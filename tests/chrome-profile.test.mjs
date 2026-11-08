import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createChromeProfile,disposeChromeProfile} from './helpers/chrome-profile.mjs';

test('profile cleanup removes only this run’s profile and rejects paths outside its directory',async()=>{
  const generated=path.resolve(import.meta.dirname,'.generated');
  fs.mkdirSync(generated,{recursive:true});
  const root=fs.mkdtempSync(path.join(generated,'profile-test-'));
  const work=path.join(root,'work'),outside=path.join(root,'profile-outside');
  fs.mkdirSync(work);fs.mkdirSync(outside);
  const first=createChromeProfile(work),other=createChromeProfile(work);
  try{
    await disposeChromeProfile(work,first);
    assert.equal(fs.existsSync(first),false);
    assert.equal(fs.existsSync(other),true);
    const warn=console.warn;console.warn=()=>{};
    try{await disposeChromeProfile(work,outside);}finally{console.warn=warn;}
    assert.equal(fs.existsSync(outside),true);
    await disposeChromeProfile(work,other);
  }finally{
    fs.rmdirSync(outside);
    fs.rmdirSync(work);
    fs.rmdirSync(root);
  }
});
