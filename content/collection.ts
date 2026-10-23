// 收藏馆只读数据：按故事世界、剧集与游戏三组浏览。
// 每条只保留作品名称、客观介绍、标签与官方来源；
// 不写观看进度、评分、时长、段位、喜爱角色或私人评价。

export type CollectionCategoryKey = 'world' | 'series' | 'game';

export type CollectionCategory = {
  key: CollectionCategoryKey;
  name: string;
};

export type CollectionItem = {
  id: string;
  category: CollectionCategoryKey;
  title: string;
  englishTitle: string;
  mark: string;
  summary: string;
  topics: string[];
  personalNote?: string;
  sourceUrl: string;
  sourceLabel: string;
};

export const collectionCategories: CollectionCategory[] = [
  { key: 'world', name: '故事世界' },
  { key: 'series', name: '剧集' },
  { key: 'game', name: '游戏' }
];

export const collectionItems: CollectionItem[] = [
  {
    id: 'ice-and-fire',
    category: 'world',
    title: '冰与火之歌',
    englishTitle: 'A Song of Ice and Fire',
    mark: 'ASOIAF',
    summary: '乔治·R·R·马丁创作的奇幻故事世界。',
    topics: ['奇幻', '世界观'],
    personalNote: '喜欢整个世界观，也喜欢引人入胜的剧情。',
    sourceUrl: 'https://georgerrmartin.com/grrm_book/a-game-of-thrones-a-song-of-ice-and-fire-book-one/',
    sourceLabel: '官方介绍'
  },
  {
    id: 'breaking-bad',
    category: 'series',
    title: '绝命毒师',
    englishTitle: 'Breaking Bad',
    mark: 'BB',
    summary: '围绕化学教师沃尔特·怀特展开的犯罪剧情剧。',
    topics: ['美剧', '犯罪剧情'],
    sourceUrl: 'https://www.sonypictures.com/tv/breakingbad',
    sourceLabel: '作品官网'
  },
  {
    id: 'game-of-thrones',
    category: 'series',
    title: '权力的游戏',
    englishTitle: 'Game of Thrones',
    mark: 'GOT',
    summary: '改编自《冰与火之歌》的 HBO 剧集。',
    topics: ['美剧', '奇幻'],
    sourceUrl: 'https://www.hbo.com/game-of-thrones',
    sourceLabel: '作品官网'
  },
  {
    id: 'the-last-of-us',
    category: 'series',
    title: '最后生还者',
    englishTitle: 'The Last of Us',
    mark: 'TLOU',
    summary: '改编自同名游戏的 HBO 剧集。',
    topics: ['美剧', '游戏改编'],
    sourceUrl: 'https://www.hbo.com/the-last-of-us',
    sourceLabel: '作品官网'
  },
  {
    id: 'cs2',
    category: 'game',
    title: 'CS2',
    englishTitle: 'Counter-Strike 2',
    mark: 'CS2',
    summary: '《Counter-Strike》系列的团队竞技射击游戏。',
    topics: ['游戏', '团队竞技'],
    sourceUrl: 'https://www.counter-strike.net/cs2',
    sourceLabel: '作品官网'
  }
];
