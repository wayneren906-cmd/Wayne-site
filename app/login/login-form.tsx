"use client";
import {useEffect,useRef,useState} from 'react';
export default function LoginForm(){
  const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState('');
  const lock=useRef(false),alert=useRef<HTMLParagraphElement|null>(null);
  useEffect(()=>{if(error)alert.current?.focus();},[error]);
  return <form className="workbench-panel workbench-form login-form" aria-busy={busy} onSubmit={async event=>{
    event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError(null);
    try{const response=await fetch('/api/auth/login',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw Error(response.status===429?'尝试过于频繁，请稍后再试。':response.status===401?'邮箱或密码不正确。':'登录服务暂时不可用，请重试。');
      const result=await response.json() as {signed_in?:unknown};if(result.signed_in!==true)throw Error('登录结果无法确认，请重试。');setPassword('');window.location.assign('/studio/private/management');
    }catch(cause){setPassword('');setError(cause instanceof Error?cause.message:'登录失败，请重试。');setBusy(false);lock.current=false;}
  }}>
    <p className="workbench-kicker">ADMINISTRATOR / EMAIL LOGIN</p><h2>管理员登录</h2>
    {error&&<p ref={alert} tabIndex={-1} role="alert" className="workbench-feedback">{error}</p>}
    <fieldset disabled={busy}><label>邮箱<input name="email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/></label>
      <label>密码<input name="password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={event=>setPassword(event.target.value)}/></label>
      <button type="submit" className="workbench-action primary">{busy?'正在登录…':'登录'}</button>
    </fieldset>
  </form>;
}
