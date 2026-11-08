import fs from 'node:fs';
import path from 'node:path';

function inside(parent,target){
  const relative=path.relative(parent,target);
  return !!relative && relative!=='..' && !relative.startsWith('..'+path.sep) && !path.isAbsolute(relative);
}

function validatedWork(work){
  const project=fs.realpathSync(path.resolve(import.meta.dirname,'../..'));
  const generated=fs.realpathSync(path.join(project,'tests/.generated'));
  const parent=fs.realpathSync(work);
  if(!inside(project,generated)||!inside(generated,parent))throw new Error('Chrome test directory is outside the project');
  return parent;
}

// Allocate a new directory for this run; never reuse or remove another test's profile.
export function createChromeProfile(work) {
  return fs.mkdtempSync(path.join(validatedWork(work),'profile-'));
}

export async function disposeChromeProfile(work,profile,chrome) {
  if(chrome && chrome.exitCode===null && chrome.signalCode===null){
    const exited=await new Promise(resolve=>{
      const onExit=()=>{clearTimeout(timer);resolve(true);};
      const timer=setTimeout(()=>{chrome.off('exit',onExit);resolve(false);},3000);
      chrome.once('exit',onExit);
      try{chrome.kill();}catch{clearTimeout(timer);chrome.off('exit',onExit);resolve(false);}
    });
    if(!exited){console.warn('Chrome did not exit; keeping its temporary profile.');return;}
  }
  if(!profile || !fs.existsSync(profile))return;
  try{
    const parent=validatedWork(work),target=fs.realpathSync(profile);
    if(!inside(parent,target) || !path.basename(target).startsWith('profile-') || fs.lstatSync(profile).isSymbolicLink()) {
      throw new Error('Chrome profile is outside its test directory');
    }
    fs.rmSync(target,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }catch(error){
    console.warn('Could not remove this run’s Chrome profile:',error.message);
  }
}
