import type {StudioPlanContent} from '@/lib/learning/contracts';
import {goalStatusLabels} from '@/lib/ui/plan-protocol';
export default function GoalList({content}:{content:StudioPlanContent}){
  return <ol className="studio-goal-list">{content.goals.map(goal=><li key={goal.id}>
    <p className="workbench-kicker">{goalStatusLabels[goal.status]}{goal.target_date&&<> · 目标日期 <time dateTime={goal.target_date}>{goal.target_date}</time></>}</p>
    <h3>{goal.title}</h3>{goal.summary&&<p className="studio-goal-copy">{goal.summary}</p>}
    <p className="workbench-note">下一步 · {goal.next_step||'暂无公开安排'}</p>
  </li>)}</ol>;
}
