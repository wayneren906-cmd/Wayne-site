'use client';

import {useEffect,useRef} from 'react';
import type {ReactNode} from 'react';

// Public Studio reading flow only. Each selector is a sibling-level reading block so a
// parent and its child are never both observed (which would double up the reveal).
const revealSelectors=[
  '.dashboard-section-heading',
  '.dashboard-empty',
  '.studio-project-index article',
  '.studio-photography-essay>header',
  '.studio-essay-grid>figure',
  '.studio-project-spread>.studio-project-heading',
  '.studio-project-spread>.studio-project-body'
];

function revealKind(element:Element){
  if(element.matches('.studio-essay-grid>figure'))return 'media';
  if(element.matches('.studio-project-spread>.studio-project-body'))return 'body';
  return 'text';
}

export default function StudioPublicMotion({className,children}:{className:string;children:ReactNode}){
  const rootRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const root=rootRef.current;
    if(!root||typeof IntersectionObserver==='undefined')return;

    const motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer:IntersectionObserver|null=null;
    const elements:Element[]=[];
    let armed=false;

    const reveal=(element:Element)=>{
      if(element.getAttribute('data-studio-revealed')==='true')return;
      element.setAttribute('data-studio-revealed','true');
      observer?.unobserve(element);
    };

    const collect=()=>{
      elements.length=0;
      for(const selector of revealSelectors){
        for(const element of root.querySelectorAll(selector)){
          // Never hide a node whose ancestor is already a target: one animation per block.
          if(elements.some(parent=>parent.contains(element)))continue;
          if(elements.includes(element))continue;
          elements.push(element);
        }
      }
    };

    const revealHash=()=>{
      const hash=window.location.hash;
      if(hash.length<2)return;
      let target:Element|null=null;
      try{target=document.getElementById(decodeURIComponent(hash.slice(1)));}catch{target=null;}
      if(!target)return;
      if(target.hasAttribute('data-studio-reveal'))reveal(target);
      for(const element of target.querySelectorAll('[data-studio-reveal]'))reveal(element);
    };

    const onFocusIn=(event:FocusEvent)=>{
      const node=event.target;
      if(!(node instanceof Element))return;
      const target=node.closest('[data-studio-reveal]');
      if(target){
        target.setAttribute('data-studio-immediate','true');
        reveal(target);
      }
    };

    const onHashChange=()=>revealHash();

    // Attributes are only added with scripting present, so the server-rendered page
    // (and every no-JS reader) keeps all content visible.
    const arm=()=>{
      collect();
      for(const element of elements){
        element.setAttribute('data-studio-reveal',revealKind(element));
        if(element.getAttribute('data-studio-revealed')!=='true')element.setAttribute('data-studio-revealed','false');
      }
      observer=new IntersectionObserver(entries=>{
        for(const entry of entries){
          if(entry.isIntersecting)reveal(entry.target);
        }
      },{threshold:.08,rootMargin:'0px 0px -24px 0px'});
      for(const element of elements)observer.observe(element);
      // Anything already on screen appears at once instead of flashing hidden for a frame.
      const viewportHeight=window.innerHeight||document.documentElement.clientHeight;
      for(const element of elements){
        const box=element.getBoundingClientRect();
        if(box.top<viewportHeight-24&&box.bottom>0)reveal(element);
      }
      revealHash();
      armed=true;
      root.setAttribute('data-studio-motion-ready','true');
    };

    const disarm=()=>{
      observer?.disconnect();
      observer=null;
      armed=false;
      root.removeAttribute('data-studio-motion-ready');
    };

    const sync=()=>{
      if(motionQuery.matches){
        disarm();
        collect();
        for(const element of elements)element.setAttribute('data-studio-revealed','true');
        return;
      }
      if(!armed)arm();
    };

    root.addEventListener('focusin',onFocusIn);
    window.addEventListener('hashchange',onHashChange);
    motionQuery.addEventListener('change',sync);
    sync();

    return ()=>{
      root.removeEventListener('focusin',onFocusIn);
      window.removeEventListener('hashchange',onHashChange);
      motionQuery.removeEventListener('change',sync);
      disarm();
    };
  },[]);

  return <div ref={rootRef} className={className}>{children}</div>;
}
