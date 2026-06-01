// Auto-generated from source-of-truth.json — DO NOT EDIT
// Run: pnpm codegen

export interface KeywordItem {
  /** 关键词 */
  word: string;
  /** 权重 0-1 */
  weight: number;
  /** 分类 */
  category: string;
}

export interface MatchProfile {
  /** 综合匹配分数 0-1 */
  score: number;
  /** 缺失项列表 */
  gaps: string[];
}

export interface JDParsed {
  keywords: KeywordItem[];
  techStack: string[];
  roleType: string;
  matchProfile: MatchProfile;
}

export interface ProjectCard {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  jdMatchScore: number;
  /** Mermaid DSL */
  architecture: string;
  challenges: FlashCardData[];
}

export interface FlashCardData {
  id: string;
  question: string;
  answer: string;
  codeSnippet?: string;
  language?: string;
}

export interface AlignmentQuestion {
  id: string;
  text: string;
  options: { id: string; text: string }[];
}

export interface STARBullet {
  id: string;
  situation: string;
  task: string;
  action: string;
  result: string;
}
