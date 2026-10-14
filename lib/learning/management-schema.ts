import {z} from 'zod';
import type {StudioManagementDTO} from './contracts.ts';

const count=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const timestamp=z.string().datetime({offset:true});
const id=z.string().min(1).max(255);
export const studioManagementSchema:z.ZodType<StudioManagementDTO>=z.object({
  generated_at:timestamp,data_version:count,last_data_change_at:timestamp.nullable(),
  private_event_count:count,received_change_count:count,latest_received_at:timestamp.nullable(),
  sources:z.array(z.object({type:z.enum(['studio','chatgpt','other']),event_count:count,latest_received_at:timestamp}).strict()).max(3),
  jobs:z.object({
    counts:z.object({pending:count,running:count,succeeded:count,failed:count,needs_attention:count}).strict(),
    recent:z.array(z.object({
      job_id:id,event_id:id,revision:count.refine(value=>value>0),data_version:count.refine(value=>value>0),
      status:z.enum(['pending','running','succeeded','failed','needs_attention']),attempts:count,created_at:timestamp,
      is_current_revision:z.boolean(),has_error:z.boolean(),
    }).strict()).max(20),
    truncated:z.boolean(),
  }).strict(),
  processor_connected:z.literal(false),
}).strict();
