'use client';
import {useEffect, useState} from 'react';
import {studioLoginHref} from '../../lib/ui/studio-navigation.ts';

export default function StudioLoginLink({returnTo}: {returnTo: string}) {
  const [href, setHref] = useState(() => studioLoginHref(returnTo));
  useEffect(() => {
    setHref(studioLoginHref(window.location.pathname + window.location.search + window.location.hash));
  }, [returnTo]);
  return <a href={href}>邮箱登录并继续 →</a>;
}
