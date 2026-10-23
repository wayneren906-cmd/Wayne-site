import { collectionCategories, collectionItems } from '@/content/collection';
import StudioShell from '../studio-shell';
import '../collection.css';

export const metadata = {
  title: '收藏馆 · 故事、剧集与游戏',
  description: '喜欢的故事、剧集与游戏，按故事世界、剧集与游戏浏览。'
};

// 只读静态页：没有客户端组件、状态、表单或筛选，条目按数据模块稳定顺序编号。
const itemNumber = (id: string) => String(collectionItems.findIndex((item) => item.id === id) + 1).padStart(2, '0');

export default function CollectionPage() {
  return (
    <StudioShell
      active="collection"
      title="收藏馆"
      kicker="COLLECTION / 个人收藏"
      description="喜欢的故事、剧集与游戏，放在这里。"
    >
      <div className="collection-root">
        <p className="collection-back">
          <a href="/studio">← 返回 Studio</a>
        </p>

        <nav className="collection-nav" aria-label="收藏分类">
          {collectionCategories.map((category) => (
            <a key={category.key} href={`#${category.key}`}>
              {category.name}
            </a>
          ))}
        </nav>

        {collectionCategories.map((category) => {
          const items = collectionItems.filter((item) => item.category === category.key);
          if (items.length === 0) return null;
          return (
            <section
              key={category.key}
              id={category.key}
              className="collection-category"
              aria-labelledby={`collection-${category.key}-title`}
            >
              <header className="collection-category-heading">
                <h2 id={`collection-${category.key}-title`}>{category.name}</h2>
                <span className="collection-category-count" aria-hidden="true">
                  {String(items.length).padStart(2, '0')}
                </span>
              </header>

              <ol className="collection-list">
                {items.map((item) => (
                  <li key={item.id} id={item.id} className="collection-item">
                    <div className="collection-item-meta">
                      <span className="collection-item-number" aria-hidden="true">
                        {itemNumber(item.id)}
                      </span>
                      <span className="collection-item-mark" aria-hidden="true">
                        {item.mark}
                      </span>
                    </div>
                    <div className="collection-item-copy">
                      <h3 className="collection-item-title">{item.title}</h3>
                      <p className="collection-item-english">{item.englishTitle}</p>
                      <p className="collection-item-summary">{item.summary}</p>
                      {item.personalNote && <p className="collection-item-note">{item.personalNote}</p>}
                      <ul className="collection-item-topics" aria-label="标签">
                        {item.topics.map((topic) => (
                          <li key={topic}>{topic}</li>
                        ))}
                      </ul>
                      <a
                        className="collection-item-source"
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.sourceLabel} <span aria-hidden="true">↗</span>
                      </a>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </StudioShell>
  );
}
