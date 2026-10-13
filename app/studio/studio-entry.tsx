'use client';
import {useMemo} from 'react';
import StudioClient from './studio-client';
import {StudioHttpClient,createStudioHttpClientAdapter} from '../../lib/ui/studio-client.ts';

export default function StudioEntry() {
  const adapter=useMemo(()=>createStudioHttpClientAdapter(new StudioHttpClient()),[]);
  return <StudioClient adapter={adapter}/>;
}
