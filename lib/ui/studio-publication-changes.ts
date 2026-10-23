import type {StudioProjectContent,StudioPlanContent} from '../learning/contracts.ts';
import {projectStatusLabels,milestoneStatusLabels} from './project-protocol.ts';
import {goalStatusLabels} from './plan-protocol.ts';
import {studioProjects} from '../studio-catalog.ts';

export type PublicationChange={label:string;before:string;after:string};
const missing='未公开',empty='未填写';
export function projectPublicationChanges(projectId:string,draft:StudioProjectContent,published:StudioProjectContent|null):PublicationChange[]{
  const changes:PublicationChange[]=[];
  function compare(label:string,before:string,after:string){if(before!==after)changes.push({label,before,after});}
  const catalogDescription=studioProjects.find(project=>project.id===projectId)?.desc??'';
  // A stored description always wins. Legacy snapshots without one fall back to the static
  // catalog introduction, which is what visitors actually see; an explicit empty value means
  // the introduction is blank. The private draft is never used as the published side.
  const described=(content:StudioProjectContent)=>content.description!==undefined?content.description||empty:catalogDescription||empty;
  compare('项目状态',published?projectStatusLabels[published.status]:missing,projectStatusLabels[draft.status]);
  compare('项目介绍',published?described(published):missing,described(draft));
  compare('进展说明',published?published.summary||empty:missing,draft.summary||empty);
  compare('下一步',published?published.next_step||empty:missing,draft.next_step||empty);
  for(const milestone of studioProjects.find(project=>project.id===projectId)?.milestones??[]){
    const id=milestone.id as keyof StudioProjectContent['milestones'];
    compare(milestone.title,published?milestoneStatusLabels[published.milestones[id]]:missing,milestoneStatusLabels[draft.milestones[id]]);
  }
  return changes;
}
export function planPublicationChanges(draft:StudioPlanContent,published:StudioPlanContent|null):PublicationChange[]{
  const changes:PublicationChange[]=[];
  for(const goal of draft.goals){
    const previous=published?.goals.find(item=>item.id===goal.id);
    const fields:[string,string,string][]=[
      ['名称',previous?.title??missing,goal.title],
      ['状态',previous?goalStatusLabels[previous.status]:missing,goalStatusLabels[goal.status]],
      ['说明',previous?previous.summary||empty:missing,goal.summary||empty],
      ['下一步',previous?previous.next_step||empty:missing,goal.next_step||empty],
      ['目标日期',previous?previous.target_date??empty:missing,goal.target_date??empty],
    ];
    for(const [field,before,after] of fields)if(before!==after)changes.push({label:goal.title+' · '+field,before,after});
  }
  for(const goal of published?.goals??[])if(!draft.goals.some(item=>item.id===goal.id))changes.push({label:goal.title+' · 从公开列表移除',before:goal.title,after:'此次发布后移除'});
  if(published&&draft.goals.length===published.goals.length&&draft.goals.some((goal,index)=>goal.id!==published.goals[index]?.id))changes.push({label:'目标顺序',before:published.goals.map(goal=>goal.title).join(' → '),after:draft.goals.map(goal=>goal.title).join(' → ')});
  return changes;
}
