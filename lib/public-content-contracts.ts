// 纯类型契约：公开内容只描述展示字段，不引入任何服务端模块。
export type PublicContentItem = {
  id: string;
  type: "project" | "journal";
  title: string;
  summary: string;
  text: string;
  url: string;
  topics: string[];
  date?: string;
};

export type WayneoSection = {
  id: string;
  title: string;
  paragraphs: string[];
};

export type WayneoProject = {
  id: string;
  title: string;
  summary: string;
  url: string;
  topics: string[];
  sections: WayneoSection[];
};
