import {latestRecordUpdate, type Entry} from './records.ts';
import {readPublicJournalRecords, readPublicJournalSnapshot} from './public-content.ts';

export type JournalData = {
  records: Entry[];
  lastSync: string | null;
  error: string;
  snapshot: {date:string;records:Entry[];error:string} | null;
};

export async function readJournalData(db: D1Database, snapshotDate = ''): Promise<JournalData> {
  const [records, snapshot] = await Promise.allSettled([
    readPublicJournalRecords(db),
    snapshotDate ? readPublicJournalSnapshot(db,snapshotDate) : Promise.resolve(null),
  ]);
  return {
    records: records.status === 'fulfilled' ? records.value : [],
    lastSync: records.status === 'fulfilled' ? latestRecordUpdate(records.value) : null,
    error: records.status === 'fulfilled' ? '' : '暂时无法读取记录，请重试。',
    snapshot: snapshotDate ? {
      date: snapshotDate,
      records: snapshot.status === 'fulfilled' ? snapshot.value?.records ?? [] : [],
      error: snapshot.status === 'fulfilled' && snapshot.value ? '' : '暂时无法读取这份快照，请重新选择或返回最新记录。',
    } : null,
  };
}
