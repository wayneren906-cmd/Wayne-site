import {z} from 'zod';
import type {StudioPlanContent,StudioPlanDraftDTO,StudioPlanMutation,StudioPlanReceiptDTO} from '../learning/contracts.ts';
export const goalStatusLabels={planned:'计划中',in_progress:'进行中',paused:'暂停',completed:'已完成'};
const natural=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER-1),positive=natural.refine(value=>value>0);
const stamp=z.string().datetime({offset:true});
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{
  const parsed=new Date(value+'T00:00:00Z');return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
},'请输入有效日期');
const goals=z.array(z.object({id:z.string().regex(/^[a-zA-Z0-9-]{1,64}$/),title:z.string().trim().min(1,'请填写目标名称').max(120),
  status:z.enum(['planned','in_progress','paused','completed']),summary:z.string().trim().max(500),next_step:z.string().trim().max(240),target_date:date.nullable()}).strict()).max(8,'最多保留 8 个目标').refine(rows=>new Set(rows.map(row=>row.id)).size===rows.length,'目标标识不可重复');
export const planContentSchema:z.ZodType<StudioPlanContent>=z.object({goals}).strict();
const base={plan_id:z.literal('personal-goals'),expected_revision:natural,idempotency_key:z.string().trim().min(1).max(255)};
export const planMutationSchema:z.ZodType<StudioPlanMutation>=z.discriminatedUnion('action',[
  z.object({...base,action:z.literal('save_draft'),content:z.object({goals,private_note:z.string().trim().max(2000)}).strict()}).strict(),
  z.object({...base,action:z.literal('publish'),confirm_public:z.literal(true)}).strict(),
  z.object({...base,action:z.literal('unpublish')}).strict(),
]);
export const planDraftSchema:z.ZodType<StudioPlanDraftDTO>=z.object({plan_id:z.literal('personal-goals'),revision:positive,draft:planContentSchema,private_note:z.string().max(2000),updated_at:stamp,
  publication:z.object({revision:positive,content:planContentSchema,published_at:stamp}).strict().nullable()}).strict().refine(row=>!row.publication||row.publication.revision<=row.revision);
export const planReceiptSchema:z.ZodType<StudioPlanReceiptDTO>=z.object({plan_id:z.literal('personal-goals'),revision:positive,action:z.enum(['save_draft','publish','unpublish']),saved:z.literal(true),replayed:z.boolean()}).strict();
export const planListSchema=z.object({plans:z.array(planDraftSchema).max(1)}).strict();
export const emptyPlanContent=():StudioPlanContent=>({goals:[]});
