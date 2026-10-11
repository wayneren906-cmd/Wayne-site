function sameContent(a,b) {
  return !!a && !!b && a.date===b.date && JSON.stringify(a.items)===JSON.stringify(b.items) && a.practice===b.practice;
}
export function checkRevision(draft,current,state,adoptExisting=false,pending={}) {
  const known=state[draft.date]?.revision;
  const attempted=pending[draft.date];
  const exactAttempt=attempted?.expectedRevision===draft.expectedRevision && sameContent(attempted,draft);
  const replay=current && current.revision===draft.expectedRevision+1 && sameContent(draft,current)
    && (known===draft.expectedRevision || known===current.revision || exactAttempt);
  if (replay) return;
  if ((current?.revision??0)!==draft.expectedRevision) throw Error('远程版本已变化，停止同步');
  if (current && !adoptExisting && known!==current.revision) throw Error('检测到人工修改或未接管的既有记录，停止同步');
}
export function verifyRecord(draft,saved,current) {
  if (!sameContent(draft,saved) || !sameContent(saved,current) || saved.revision!==current?.revision
      || saved.updatedAt!==current?.updatedAt) throw Error('写入后核对失败，未记录同步成功');
}
