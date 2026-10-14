"use client";
import {useState} from 'react';
import './logout.css';
export default function LogoutButton(){
  const [busy,setBusy]=useState(false),[error,setError]=useState(false);
  return <span><button className="workbench-action email-logout" type="button" disabled={busy} onClick={async()=>{if(busy)return;setBusy(true);setError(false);try{const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error();window.location.assign('/studio');}catch{setError(true);setBusy(false);}}}>{busy?'退出中…':'退出登录'}</button>{error&&<span role="alert">退出失败，请重试。</span>}</span>;
}
