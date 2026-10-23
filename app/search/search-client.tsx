"use client";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { PublicContentItem } from "@/lib/public-content-contracts";

type ContentType = "all" | "project" | "journal";

const TYPE_ORDER: ContentType[] = ["all", "project", "journal"];

// 用字面量匹配并交给 React 渲染 <mark>，不拼用户输入的正则，也不使用 dangerouslySetInnerHTML。
function highlight(text: string, needle: string): ReactNode {
  if (!needle) return text;
  const haystack = text.toLowerCase();
  const nodes: ReactNode[] = [];
  let from = 0;
  let at = haystack.indexOf(needle, from);
  let key = 0;
  while (at !== -1) {
    if (at > from) nodes.push(text.slice(from, at));
    nodes.push(<mark key={`mark-${key++}`}>{text.slice(at, at + needle.length)}</mark>);
    from = at + needle.length;
    at = haystack.indexOf(needle, from);
  }
  if (from < text.length) nodes.push(text.slice(from));
  return nodes.length > 0 ? nodes : text;
}

function excerpt(text: string, needle: string): string {
  const at = text.toLowerCase().indexOf(needle);
  if (at < 0) return text.slice(0, 160);
  const start = Math.max(0, at - 48);
  const end = Math.min(text.length, at + needle.length + 96);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function isMatch(item: PublicContentItem, needle: string, type: ContentType, topic: string): boolean {
  if (type !== "all" && item.type !== type) return false;
  if (topic !== "all" && !item.topics.includes(topic)) return false;
  if (!needle) return true;
  return [item.title, item.summary, item.text, item.topics.join(" ")]
    .join("\n")
    .toLowerCase()
    .includes(needle);
}

// 只在标题和摘要都没命中时，展示正文命中处的摘要，保证结果可理解。
function summaryFor(item: PublicContentItem, needle: string): string {
  if (!needle) return item.summary;
  if (item.title.toLowerCase().includes(needle) || item.summary.toLowerCase().includes(needle)) return item.summary;
  if (item.text.toLowerCase().includes(needle)) return excerpt(item.text, needle);
  return item.summary;
}

export default function SearchClient({
  items,
  initialQuery,
  initialType,
  initialTopic
}: {
  items: PublicContentItem[];
  initialQuery: string;
  initialType: ContentType;
  initialTopic?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState<ContentType>(initialType);
  const [topic, setTopic] = useState(initialTopic ?? "all");

  const topicOptions = useMemo(
    () => [...new Set(items.flatMap((item) => item.topics))].sort((a, b) => a.localeCompare(b, "zh-CN")),
    [items]
  );
  const activeTopic = topic !== "all" && topicOptions.includes(topic) ? topic : "all";
  const needle = query.trim().toLowerCase();
  const results = useMemo(
    () => items.filter((item) => isMatch(item, needle, type, activeTopic)),
    [items, needle, type, activeTopic]
  );

  // 输入只是检索：筛选状态同步到地址栏，方便刷新与分享，不写入任何内容。
  useEffect(() => {
    const url = new URL(window.location.href);
    const trimmed = query.trim();
    if (trimmed) url.searchParams.set("q", trimmed);
    else url.searchParams.delete("q");
    if (type !== "all") url.searchParams.set("type", type);
    else url.searchParams.delete("type");
    if (activeTopic !== "all") url.searchParams.set("topic", activeTopic);
    else url.searchParams.delete("topic");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [query, type, activeTopic]);

  return (
    <div className="public-search">
      <form className="public-search-form" action="/search" method="get" role="search">
        <input
          className="public-search-input"
          type="search"
          name="q"
          aria-label="搜索公开内容"
          placeholder="搜索项目与手记"
          value={query}
          maxLength={200}
          onChange={(event) => setQuery(event.target.value)}
        />
        <input type="hidden" name="type" value={type} />
        {activeTopic !== "all" && <input type="hidden" name="topic" value={activeTopic} />}
        <button type="submit" className="public-search-submit">
          搜索
        </button>
      </form>

      <div className="public-search-filters">
        <div className="public-search-types" role="group" aria-label="按类别筛选">
          {TYPE_ORDER.map((value) => (
            <button key={value} type="button" aria-pressed={type === value} onClick={() => setType(value)}>
              {value === "all" ? "全部" : value === "project" ? "项目" : "手记"}
            </button>
          ))}
        </div>
        {topicOptions.length > 0 && (
          <label className="public-search-topic">
            <span>主题</span>
            <select value={activeTopic} onChange={(event) => setTopic(event.target.value)}>
              <option value="all">全部主题</option>
              {topicOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <p className="public-search-meta" role="status">
        {items.length === 0
          ? "暂时没有公开内容。"
          : results.length === 0
            ? "没有找到匹配的内容。"
            : `共 ${results.length} 条公开内容`}
      </p>

      {items.length === 0 ? (
        <p className="public-search-empty">公开内容还未整理完成，之后会收录在这里。</p>
      ) : results.length === 0 ? (
        <p className="public-search-empty">换个关键词，或把类别与主题放宽一些。</p>
      ) : (
        <div className="public-search-results">
          {results.map((item) => (
            <article key={item.id} className="public-search-result" data-public-result>
              <div className="public-search-result-meta">
                <span>{item.type === "project" ? "项目" : "手记"}</span>
                {item.date && <time dateTime={item.date}>{item.date}</time>}
              </div>
              <h2>
                <a href={item.url}>{highlight(item.title, needle)}</a>
              </h2>
              <p className="public-search-summary">{highlight(summaryFor(item, needle), needle)}</p>
              {item.topics.length > 0 && (
                <ul className="public-search-topics" aria-label="主题">
                  {item.topics.map((value) => (
                    <li key={value}>{value}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
