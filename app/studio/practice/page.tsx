import {practiceExercises,learningStages} from '@/lib/studio-catalog';
import StudioShell from '../studio-shell';
import PracticeCatalog from './practice-catalog';
export const metadata={title:'练习目录 · Studio'};
export default function PracticePage(){return <StudioShell active="practice" title="练习目录" description="浏览建议练习的目标、步骤与验收条件。管理员可记录私人练习过程；这里不代表已安排的任务。"><section aria-labelledby="exercise-list-title"><h2 id="exercise-list-title" className="workbench-section-title">建议练习目录</h2><PracticeCatalog/></section><p className="workbench-footnote">目录共 {practiceExercises.length} 项建议练习，覆盖 {learningStages.length} 个阶段。没有选择或提交不会被记作已开始，提交记录也不等于通过评估。</p></StudioShell>;}
