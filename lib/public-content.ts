import type { Entry } from "./records.ts";
import { readRecords } from "./database.ts";
import { wayneoProject } from "../content/wayneo.ts";
import { journalEntries } from "../content/journal.ts";
import { dateSchema } from "./records.ts";
import type { PublicContentItem } from "./public-content-contracts.ts";

// 公开阅读边界：只把 records 中已经公开的字段按 Entry 形状重新投影，
// 不做整行展开，也不读取私人草稿、备注或其他私有表。
export async function readPublicJournalRecords(db: D1Database): Promise<Entry[]> {
  const records = [...journalEntries,...await readRecords(db)];
  const dates=new Set<string>();
  return records.map((record) => {
    const date=dateSchema.parse(record.date);
    if(dates.has(date))throw new Error(`PUBLIC_CONTENT_ID_CONFLICT:journal:${date}`);
    dates.add(date);
    return {
    date: record.date,
    items: record.items.map((item) => ({ label: item.label, text: item.text })),
    practice: record.practice,
    revision: record.revision,
    updatedAt: record.updatedAt,
  };}).sort((a,b)=>b.date.localeCompare(a.date));
}

const sameItem = (a: PublicContentItem, b: PublicContentItem) =>
  a.id === b.id &&
  a.type === b.type &&
  a.title === b.title &&
  a.summary === b.summary &&
  a.text === b.text &&
  a.url === b.url &&
  a.date === b.date &&
  a.topics.length === b.topics.length &&
  a.topics.every((topic, index) => topic === b.topics[index]);

function pushUnique(items: PublicContentItem[], item: PublicContentItem): void {
  const existing = items.find((candidate) => candidate.id === item.id);
  if (!existing) {
    items.push(item);
    return;
  }
  // 同一稳定 id 的完全重复内容按去重处理，内容不一致则报错，绝不静默覆盖。
  if (sameItem(existing, item)) return;
  throw new Error(`PUBLIC_CONTENT_ID_CONFLICT:${item.id}`);
}

function projectText(): string {
  return wayneoProject.sections
    .map((section) => [section.title, ...section.paragraphs].join("\n"))
    .join("\n\n");
}

function journalSummary(record: Entry): string {
  const notes = record.items.map((item) => `${item.label}：${item.text}`).join("；");
  const text=record.practice ? `${notes}。练习与补充：${record.practice}` : notes;
  return text.length>160?`${text.slice(0,160)}…`:text;
}

function journalText(record: Entry): string {
  const notes = record.items.map((item) => `${item.label}\n${item.text}`).join("\n\n");
  return record.practice ? `${notes}\n\n练习与补充\n${record.practice}` : notes;
}

export async function readPublicContent(db: D1Database): Promise<PublicContentItem[]> {
  const records = await readPublicJournalRecords(db);
  const items: PublicContentItem[] = [];

  pushUnique(items, {
    id: wayneoProject.id,
    type: "project",
    title: wayneoProject.title,
    summary: wayneoProject.summary,
    text: projectText(),
    url: wayneoProject.url,
    topics: [...wayneoProject.topics],
  });

  for (const record of records) {
    const topics = [...new Set(record.items.map((item) => item.label.trim()).filter(Boolean))];
    pushUnique(items, {
      id: `journal:${record.date}`,
      type: "journal",
      title: `${record.date} 学习手记`,
      summary: journalSummary(record),
      text: journalText(record),
      url: `/learning?date=${encodeURIComponent(record.date)}`,
      topics,
      date: record.date,
    });
  }

  return items;
}
