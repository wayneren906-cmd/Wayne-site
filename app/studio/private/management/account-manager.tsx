"use client";
import {useEffect,useRef,useState} from 'react';
type Account={account_id:string;email:string;role:'owner'|'admin';status:'active'|'disabled'};
export default function AccountManager(){
  const [accounts,setAccounts]=useState<Account[]|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState<string|null>(null),[error,setError]=useState<string|null>(null);
  const lock=useRef(false),alert=useRef<HTMLParagraphElement|null>(null);
  useEffect(()=>{if(error)alert.current?.focus();},[error]);
  async function load(){const response=await fetch('/api/auth/accounts',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('管理员列表无法读取，请重试。');const result=await response.json() as {accounts?:Account[]};if(!Array.isArray(result.accounts))throw Error('管理员列表不完整');setAccounts(result.accounts);}
  return <section className="workbench-panel" style={{marginTop:32}}><p className="workbench-kicker">ADMINISTRATORS</p><h2>管理员账号</h2><p>新管理员可以管理这个数字空间中的内容。只有首位管理员能够添加账号。</p>
    {error&&<p ref={alert} tabIndex={-1} role="alert" className="workbench-feedback">{error}</p>}{message&&<p role="status" className="workbench-feedback">{message}</p>}
    <button className="workbench-action" type="button" disabled={busy} onClick={async()=>{setError(null);try{await load();}catch(cause){setError(cause instanceof Error?cause.message:'读取失败');}}}>读取管理员列表</button>
    {accounts&&<ul>{accounts.map(account=><li key={account.account_id}>{account.email} · {account.role==='owner'?'首位管理员':'管理员'} · {account.status==='active'?'启用':'停用'}</li>)}</ul>}
    <form className="workbench-form" onSubmit={async event=>{event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError(null);setMessage(null);try{
      const response=await fetch('/api/auth/accounts',{method:'POST',credentials:'same-origin',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw Error(response.status===409?'邮箱已存在或管理权限已变化。':response.status===403?'无权添加管理员。':'添加未完成，请重新读取账号列表后核对。');
      const result=await response.json() as {created?:unknown};if(result.created!==true)throw Error('添加结果无法确认，请读取列表核对。');setPassword('');setEmail('');setMessage('管理员已添加。');await load();
    }catch(cause){setPassword('');setError(cause instanceof Error?cause.message:'添加失败，请核对列表。');}finally{lock.current=false;setBusy(false);}}}>
      <fieldset disabled={busy} style={{border:0,padding:0,display:'grid',gap:16,minWidth:0}}><label>新管理员邮箱<input required type="email" autoComplete="off" value={email} maxLength={254} onChange={event=>setEmail(event.target.value)}/></label><label>初始密码<input required type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={event=>setPassword(event.target.value)}/></label><button className="workbench-action primary" type="submit">{busy?'正在添加…':'添加管理员'}</button></fieldset>
    </form>
  </section>;
}
