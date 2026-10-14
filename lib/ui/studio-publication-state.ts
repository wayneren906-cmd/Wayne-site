export function studioPublicationState({dirty, hasDraft, hasPublication, matchesPublication, hasContent}: {
  dirty: boolean; hasDraft: boolean; hasPublication: boolean; matchesPublication: boolean; hasContent: boolean;
}) {
  return {
    draftLabel: dirty ? '有修改未保存' : hasDraft ? '已保存，仅管理员可见' : '尚未保存',
    publicationLabel: !hasPublication ? '尚未公开' : matchesPublication ? '已公开，与已保存草稿一致' : '已公开，有草稿更新待发布',
    publishHint: dirty ? '请先保存修改，再预览发布。现有公开版本保持不变。'
      : !hasDraft ? '请先填写内容并保存私人草稿。'
      : !hasContent ? '请补充发布内容并保存后再预览。'
      : matchesPublication ? '已保存内容与公开版本一致，无需重复发布。'
      : '保存不会自动公开。预览后确认发布，才会更新访客看到的内容。',
  };
}
