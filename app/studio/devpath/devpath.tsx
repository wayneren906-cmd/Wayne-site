'use client';

import {useEffect} from 'react';
import {devPathDetailHref,devPathIdFromHash} from '@/lib/devpath';

// Only legacy fragments require client code. All reading and navigation is server-rendered.
export default function DevPathLegacyLinks({ids}:{ids:string[]}){
  useEffect(()=>{
    function redirect(){
      const id=devPathIdFromHash(window.location.hash,ids);
      if(id)window.location.replace(devPathDetailHref(id)+window.location.search);
    }
    redirect();
    window.addEventListener('hashchange',redirect);
    return ()=>window.removeEventListener('hashchange',redirect);
  },[ids]);
  return null;
}
