import {z} from 'zod';
import type {StudioProjectContent,StudioProjectDraftDTO,StudioProjectMutation,StudioProjectReceiptDTO} from '../learning/contracts.ts';

export const projectIds=['c-engine','embedded-controller','automotive-bus','wayneo'] as const;
export const projectStatusLabels={not_started:'未开始',in_progress:'进行中',paused:'暂停',completed:'已完成'};
export const milestoneStatusLabels={not_started:'未开始',in_progress:'进行中',completed:'已完成'};
const natural=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER-1);
const stamp=z.string().datetime({offset:true});
export const projectContentSchema:z.ZodType<StudioProjectContent>=z.object({
  status:z.enum(['not_started','in_progress','paused','completed']),summary:z.string().trim().max(1200),description:z.string().trim().max(2000).optional(),next_step:z.string().trim().max(240),
  milestones:z.object({interface:z.enum(['not_started','in_progress','completed']),implementation:z.enum(['not_started','in_progress','completed']),verification:z.enum(['not_started','in_progress','completed'])}).strict(),
}).strict().refine(content=>content.status!=='completed'||Object.values(content.milestones).every(state=>state==='completed'),'项目完成前，请先确认全部里程碑状态');
const base={project_id:z.enum(projectIds),expected_revision:natural,idempotency_key:z.string().trim().min(1).max(255)};
const editable=z.object({status:z.enum(['not_started','in_progress','paused','completed']),summary:z.string().trim().max(1200),description:z.string().trim().max(2000).optional(),next_step:z.string().trim().max(240),milestones:z.object({interface:z.enum(['not_started','in_progress','completed']),implementation:z.enum(['not_started','in_progress','completed']),verification:z.enum(['not_started','in_progress','completed'])}).strict(),private_note:z.string().trim().max(2000)}).strict().refine(content=>content.status!=='completed'||Object.values(content.milestones).every(state=>state==='completed'),'项目完成前，请先确认全部里程碑状态');
export const projectMutationSchema:z.ZodType<StudioProjectMutation>=z.discriminatedUnion('action',[
  z.object({...base,action:z.literal('save_draft'),content:editable}).strict(),
  z.object({...base,action:z.literal('publish'),confirm_public:z.literal(true)}).strict(),
  z.object({...base,action:z.literal('unpublish')}).strict(),
]);
export const projectDraftSchema:z.ZodType<StudioProjectDraftDTO>=z.object({project_id:z.enum(projectIds),revision:natural.refine(value=>value>0),draft:projectContentSchema,private_note:z.string().max(2000),updated_at:stamp,publication:z.object({revision:natural.refine(value=>value>0),content:projectContentSchema,published_at:stamp}).strict().nullable()}).strict();
export const projectReceiptSchema:z.ZodType<StudioProjectReceiptDTO>=z.object({project_id:z.enum(projectIds),revision:natural.refine(value=>value>0),action:z.enum(['save_draft','publish','unpublish']),saved:z.literal(true),replayed:z.boolean()}).strict();
export const projectListSchema=z.object({projects:z.array(projectDraftSchema).max(projectIds.length)}).strict();
export const emptyProjectContent=():StudioProjectContent=>({status:'not_started',summary:'',next_step:'',milestones:{interface:'not_started',implementation:'not_started',verification:'not_started'}});
