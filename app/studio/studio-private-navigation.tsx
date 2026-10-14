export type PrivateSection = 'management' | 'records' | 'projects' | 'plans' | 'system';
const sections = [
  ['management', '/studio/private/management', '工作台'],
  ['records', '/studio/private', '私人记录'],
  ['projects', '/studio/private/projects', '项目管理'],
  ['plans', '/studio/private/plans', '目标管理'],
  ['system', '/studio/private/system', '系统与账号'],
] as const;

export default function StudioPrivateNavigation({active}: {active: PrivateSection}) {
  return <nav className="workbench-tabs" aria-label="私人管理栏目">
    {sections.map(([id, href, label],index) => <a key={id} href={href} aria-current={active === id ? 'page' : undefined}><span className="studio-tab-number" aria-hidden="true">{String(index+1).padStart(2,'0')}</span>{label}</a>)}
  </nav>;
}
