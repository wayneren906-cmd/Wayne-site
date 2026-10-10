import { z } from "zod";
export function learningDate(now = new Date()) {
  return new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, "日期无效");
export const recordSchema = z.object({
  date: dateSchema,
  items: z.array(z.object({ label: z.string().trim().min(1).max(40), text: z.string().trim().min(1).max(2000) })).min(1).max(12),
  practice: z.string().trim().max(2000), expectedRevision: z.number().int().min(0),
});
export type Entry = { date: string; items: {label: string; text: string}[]; practice: string; revision: number; updatedAt: string };
