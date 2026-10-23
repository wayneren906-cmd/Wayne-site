type StudioProjectDescriptionProps={
  description:string;
  summary:string;
  nextStep?:string;
  nextStepLabel?:string;
};

export default function StudioProjectDescription({description,summary,nextStep,nextStepLabel}:StudioProjectDescriptionProps){
  const next=nextStep?.trim();
  const nextHeading=nextStepLabel?.trim()||'下一步';
  // 显式空字符串表示不公开项目介绍：不渲染空的介绍章节，也绝不用私人草稿填充。
  const hasDescription=!!description.trim();
  return <div className="studio-project-description">
    {hasDescription&&<section className="studio-project-intro" aria-label="项目介绍">
      <h3>项目介绍</h3>
      <p>{description}</p>
    </section>}
    <section className="studio-project-progress" aria-label="当前进展">
      <h3>当前进展</h3>
      <p>{summary}</p>
    </section>
    {next&&<section className="studio-project-next" aria-label={nextHeading}>
      <h3>{nextHeading}</h3>
      <p>{next}</p>
    </section>}
  </div>;
}
