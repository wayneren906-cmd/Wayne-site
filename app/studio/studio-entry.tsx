'use client';
import {useMemo} from 'react';
import StudioClient from './studio-client';
import {StudioHttpClient,createStudioHttpClientAdapter} from '../../lib/ui/studio-client.ts';

export default function StudioEntry({showSupplement=true}:{showSupplement?:boolean}={}) {
  const adapter=useMemo(()=>createStudioHttpClientAdapter(new StudioHttpClient(),{purpose:'review'}),[]);
  return <StudioClient adapter={adapter} showSupplement={showSupplement}/>;
}
