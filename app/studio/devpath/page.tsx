import type {Metadata} from 'next';
import {devPathIds,devPathIntroduction} from '@/content/devpath';
import DevPathLegacyLinks from './devpath';
import DevPathOverview from './devpath-overview';

export const metadata:Metadata={
  title:'DevPath · 成长档案',
  description:devPathIntroduction.description,
  alternates:{canonical:'https://wayneo.dev/studio/devpath'},
  openGraph:{title:'DevPath · 学习、实践与阶段记录。',description:devPathIntroduction.description,url:'https://wayneo.dev/studio/devpath'},
};

export default function DevPathPage(){
  return <main className="devpath dp-archive">
    <a className="dp-skip" href="#current">跳到当前阶段</a>
    <DevPathLegacyLinks ids={devPathIds}/>
    <DevPathOverview/>
  </main>;
}
